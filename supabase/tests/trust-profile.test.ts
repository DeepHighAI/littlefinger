import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  asDeviceTokenUnregisterResponse,
  asTrustProfileDetailResponse,
  asTrustProfileSettingsUpdateResponse,
  type ReminderPreferences,
} from '../../packages/shared/src/index.ts';
import {
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

let db: TestDb;

async function oneJson(
  sql: string,
  params: readonly unknown[],
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(sql, [...params]);
  const value = rows[0]?.['result'];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('EXPECTED_JSON_OBJECT');
  }
  return value as Record<string, unknown>;
}

const MORNING: ReminderPreferences = {
  remind_d7: true,
  remind_d3: true,
  remind_d1: true,
  remind_dday: true,
  remind_hour: '09',
};

const EVENING: ReminderPreferences = {
  remind_d7: false,
  remind_d3: true,
  remind_d1: false,
  remind_dday: true,
  remind_hour: '20',
};

function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('F-09 trust profile transactions', () => {
  test('빈 캐시는 행을 만들지 않고 0건·기본 리마인드만 반환한다', async () => {
    const actor = await createUser(db, uniqueName('profile'));
    await db.asAdmin(
      `update public.users
          set updated_at = '2026-08-17T00:00:00Z'::timestamptz
        where id = $1`,
      [actor],
    );

    const raw = await oneJson(
      `select public.lf_my_trust_profile($1::uuid) as result`,
      [actor],
    );
    const payload = asTrustProfileDetailResponse(raw);

    expect(payload).toMatchObject({
      nickname: expect.stringContaining('profile-'),
      profile_image_url: null,
      keep_rate: null,
      completed_count: 0,
      broken_count: 0,
      disputed_count: 0,
      unresolved_count: 0,
      active_count: 0,
      updated_at: '2026-08-17T00:00:00+00:00',
      reminders: MORNING,
    });
    expect(Object.keys(raw).sort()).toEqual([
      'active_count',
      'broken_count',
      'completed_count',
      'disputed_count',
      'keep_rate',
      'nickname',
      'profile_image_url',
      'reminders',
      'unresolved_count',
      'updated_at',
    ]);
    const { rows } = await db.asAdmin(
      `select count(*)::int as count from public.trust_profiles where user_id = $1`,
      [actor],
    );
    expect(rows).toEqual([{ count: 0 }]);
  });

  test('부분 설정은 기본값과 합치고 캐시가 있으면 캐시 시각을 반환한다', async () => {
    const actor = await createUser(db, uniqueName('partial'));
    await db.asAdmin(
      `update public.users
          set notification_pref = '{"remind_d1": false, "remind_hour": "12"}'::jsonb
        where id = $1`,
      [actor],
    );
    await db.asAdmin(
      `insert into public.trust_profiles
         (user_id, completed_count, broken_count, disputed_count, unresolved_count,
          active_count, keep_rate, updated_at)
       values ($1, 3, 1, 2, 1, 4, 75, '2026-08-17T01:00:00Z')`,
      [actor],
    );

    const payload = asTrustProfileDetailResponse(
      await oneJson(`select public.lf_my_trust_profile($1::uuid) as result`, [actor]),
    );

    expect(payload).toMatchObject({
      keep_rate: 75,
      completed_count: 3,
      broken_count: 1,
      disputed_count: 2,
      unresolved_count: 1,
      // 스냅숏에 4가 있어도 무시한다 — active_count 는 라이브 계산이다(F6).
      active_count: 0,
      updated_at: '2026-08-17T01:00:00+00:00',
      reminders: { ...MORNING, remind_d1: false, remind_hour: '12' },
    });
  });

  test('active_count는 스냅숏이 아니라 §4-1-4의 4개 상태를 라이브로 센다(F6)', async () => {
    const actor = await createUser(db, uniqueName('live'));
    const other = await createUser(db, uniqueName('live-other'));
    // 운영 재현(E2E Run 1 F6): 승인 직후 ACTIVE 는 종결 이벤트 전까지 스냅숏에 없다.
    for (const status of [
      'PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING', 'DRAFT', 'COMPLETED',
    ]) {
      await createPromise(db, { creatorId: actor, partnerId: other, status });
    }
    await db.asAdmin(
      `insert into public.trust_profiles
         (user_id, completed_count, broken_count, disputed_count, unresolved_count,
          active_count, keep_rate)
       values ($1, 0, 0, 0, 0, 99, null)`,
      [actor],
    );

    const payload = asTrustProfileDetailResponse(
      await oneJson(`select public.lf_my_trust_profile($1::uuid) as result`, [actor]),
    );

    expect(payload?.active_count).toBe(4);
  });

  test('없는 사용자와 비활성 사용자는 공개 응답 없이 거부한다', async () => {
    const suspended = await createUser(db, uniqueName('suspended'));
    await db.asAdmin(`update public.users set status = 'SUSPENDED' where id = $1`, [suspended]);

    await expect(
      db.asAdmin(`select public.lf_my_trust_profile($1::uuid)`, [randomUUID()]),
    ).rejects.toThrow(/E_AUTH_REQUIRED/iu);
    await expect(
      db.asAdmin(`select public.lf_my_trust_profile($1::uuid)`, [suspended]),
    ).rejects.toThrow(/E_FORBIDDEN/iu);
  });

  test('전체 설정을 원자 저장하고 배우 행의 D-day 예약 시각만 KST 20시로 바꾼다', async () => {
    const actor = await createUser(db, uniqueName('settings'));
    const other = await createUser(db, uniqueName('settings-other'));
    const promiseId = await createPromise(db, {
      creatorId: actor,
      partnerId: other,
      status: 'ACTIVE',
      endDateOffsetDays: 30,
    });
    await db.asAdmin(
      `update public.users
          set notification_pref = '{"future_key": "keep"}'::jsonb
        where id = $1`,
      [actor],
    );
    await db.asAdmin(
      `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
       select $2, actor.user_id, kind.kind::public.reminder_kind,
              '2026-08-20T00:00:00Z'::timestamptz
         from (values ($1::uuid), ($3::uuid)) actor(user_id)
         cross join (values ('D7'), ('D3'), ('D1'), ('DDAY')) kind(kind)`,
      [actor, promiseId, other],
    );

    const raw = await oneJson(
      `select public.lf_trust_profile_settings_update($1,$2,$3::jsonb) as result`,
      [randomUUID(), actor, JSON.stringify(EVENING)],
    );
    expect(asTrustProfileSettingsUpdateResponse(raw)?.reminders).toEqual(EVENING);

    const stored = await db.asAdmin(
      `select notification_pref from public.users where id = $1`,
      [actor],
    );
    expect(stored.rows[0]?.['notification_pref']).toEqual({
      future_key: 'keep',
      ...EVENING,
    });

    const schedules = await db.asAdmin(
      `select user_id::text, kind::text,
              to_char(fire_at at time zone 'Asia/Seoul', 'HH24') as hour,
              status::text
         from public.reminder_schedules
        where promise_id = $1
        order by user_id, kind`,
      [promiseId],
    );
    const actorRows = schedules.rows.filter((row) => row['user_id'] === actor);
    const otherRows = schedules.rows.filter((row) => row['user_id'] === other);
    expect(actorRows).toHaveLength(4);
    expect(actorRows.every((row) => row['hour'] === '20' && row['status'] === 'PENDING')).toBe(true);
    expect(otherRows.every((row) => row['hour'] === '09')).toBe(true);
  });

  test('설정은 다섯 필드의 정확한 타입과 허용 시각만 받는다', async () => {
    const actor = await createUser(db, uniqueName('invalid-settings'));
    const invalid = [
      { ...MORNING, remind_hour: '10' },
      { ...MORNING, remind_hour: 12 },
      { ...MORNING, remind_d7: 'true' },
      { remind_d7: true },
      { ...MORNING, extra: true },
      null,
    ];

    for (const reminders of invalid) {
      await expect(
        db.asAdmin(
          `select public.lf_trust_profile_settings_update($1,$2,$3::jsonb)`,
          [randomUUID(), actor, JSON.stringify(reminders)],
        ),
      ).rejects.toThrow(/E_VALIDATION/iu);
    }
  });

  test('같은 설정 멱등 키는 첫 응답을 재생하고 새 키만 다음 변경을 적용한다', async () => {
    const actor = await createUser(db, uniqueName('idempotent-settings'));
    const key = randomUUID();
    const first = await oneJson(
      `select public.lf_trust_profile_settings_update($1,$2,$3::jsonb) as result`,
      [key, actor, JSON.stringify(EVENING)],
    );
    const replay = await oneJson(
      `select public.lf_trust_profile_settings_update($1,$2,$3::jsonb) as result`,
      [key, actor, JSON.stringify(MORNING)],
    );
    expect(replay).toEqual(first);

    const next = await oneJson(
      `select public.lf_trust_profile_settings_update($1,$2,$3::jsonb) as result`,
      [randomUUID(), actor, JSON.stringify(MORNING)],
    );
    expect(asTrustProfileSettingsUpdateResponse(next)?.reminders).toEqual(MORNING);
  });

  test('동일 설정 키의 겹친 호출은 한 응답과 한 저장 결과로 수렴한다', async () => {
    const actor = await createUser(db, uniqueName('parallel-settings'));
    const key = randomUUID();
    const call = async () => await oneJson(
      `select public.lf_trust_profile_settings_update($1,$2,$3::jsonb) as result`,
      [key, actor, JSON.stringify(EVENING)],
    );

    const [first, second] = await Promise.all([call(), call()]);
    expect(second).toEqual(first);
    const { rows } = await db.asAdmin(
      `select count(*)::int as count from public.idempotency_keys where key = $1`,
      [key],
    );
    expect(rows).toEqual([{ count: 1 }]);
  });

  test('기기 토큰은 배우의 정확한 행만 지우고 같은 키는 첫 응답을 재생한다', async () => {
    const actor = await createUser(db, uniqueName('token'));
    const other = await createUser(db, uniqueName('token-other'));
    const actorToken = `ExponentPushToken[${randomUUID()}]`;
    const otherToken = `ExponentPushToken[${randomUUID()}]`;
    await db.asAdmin(
      `insert into public.device_tokens (user_id, fcm_token, platform)
       values ($1, $2, 'ANDROID'), ($3, $4, 'ANDROID')`,
      [actor, actorToken, other, otherToken],
    );

    const key = randomUUID();
    const removed = await oneJson(
      `select public.lf_device_token_unregister($1,$2,$3) as result`,
      [key, actor, actorToken],
    );
    const replay = await oneJson(
      `select public.lf_device_token_unregister($1,$2,$3) as result`,
      [key, actor, actorToken],
    );
    expect(asDeviceTokenUnregisterResponse(removed)).toEqual({ removed: true });
    expect(replay).toEqual(removed);

    const forbidden = await oneJson(
      `select public.lf_device_token_unregister($1,$2,$3) as result`,
      [randomUUID(), actor, otherToken],
    );
    expect(forbidden).toEqual({ removed: false });
    const remaining = await db.asAdmin(
      `select user_id::text, fcm_token from public.device_tokens order by fcm_token`,
    );
    expect(remaining.rows).toEqual([{ user_id: other, fcm_token: otherToken }]);
  });

  test('토큰 부재 응답을 재생할 때 나중에 다른 계정에 등록된 같은 토큰을 지우지 않는다', async () => {
    const actor = await createUser(db, uniqueName('token-snapshot'));
    const other = await createUser(db, uniqueName('token-snapshot-other'));
    const token = `ExponentPushToken[${randomUUID()}]`;
    const key = randomUUID();
    expect(await oneJson(
      `select public.lf_device_token_unregister($1,$2,$3) as result`,
      [key, actor, token],
    )).toEqual({ removed: false });
    await db.asAdmin(
      `insert into public.device_tokens (user_id, fcm_token, platform)
       values ($1, $2, 'ANDROID')`,
      [other, token],
    );

    expect(await oneJson(
      `select public.lf_device_token_unregister($1,$2,$3) as result`,
      [key, actor, token],
    )).toEqual({ removed: false });
    const { rows } = await db.asAdmin(
      `select user_id::text from public.device_tokens where fcm_token = $1`,
      [token],
    );
    expect(rows).toEqual([{ user_id: other }]);
  });
});

describe('J-10 trust profile repair', () => {
  test('keeper 범위와 별도 종결 건수를 전량 재계산하고 두 실행이 같은 값으로 수렴한다', async () => {
    const actor = await createUser(db, uniqueName('j10'));
    const other = await createUser(db, uniqueName('j10-other'));

    async function add(
      status: string,
      role: 'CREATOR' | 'PARTNER',
      keeper: 'CREATOR' | 'PARTNER' | 'BOTH',
    ): Promise<void> {
      const promiseId = role === 'CREATOR'
        ? await createPromise(db, { creatorId: actor, partnerId: other, status })
        : await createPromise(db, { creatorId: other, partnerId: actor, status });
      await db.asAdmin(
        `update public.promises set keeper = $2::public.keeper where id = $1`,
        [promiseId, keeper],
      );
    }

    await add('COMPLETED', 'CREATOR', 'CREATOR');
    await add('COMPLETED', 'PARTNER', 'PARTNER');
    await add('BROKEN', 'CREATOR', 'BOTH');
    await add('BROKEN', 'CREATOR', 'PARTNER');
    await add('DISPUTED', 'CREATOR', 'PARTNER');
    await add('UNRESOLVED', 'PARTNER', 'CREATOR');
    await add('ACTIVE', 'PARTNER', 'BOTH');
    // §4-1-4의 "진행 중"은 PENDING 을 포함한다(F6).
    await add('PENDING', 'CREATOR', 'BOTH');
    await db.asAdmin(
      `insert into public.trust_profiles
         (user_id, completed_count, broken_count, disputed_count, unresolved_count,
          active_count, keep_rate)
       values ($1, 99, 99, 99, 99, 99, 1)`,
      [actor],
    );

    await db.asService(`select public.lf_recompute_all_trust_profiles()`);
    const first = await db.asAdmin(
      `select completed_count, broken_count, disputed_count, unresolved_count,
              active_count, keep_rate
         from public.trust_profiles where user_id = $1`,
      [actor],
    );
    await db.asService(`select public.lf_recompute_all_trust_profiles()`);
    const second = await db.asAdmin(
      `select completed_count, broken_count, disputed_count, unresolved_count,
              active_count, keep_rate
         from public.trust_profiles where user_id = $1`,
      [actor],
    );

    expect(first.rows).toEqual([{
      completed_count: 2,
      broken_count: 1,
      disputed_count: 1,
      unresolved_count: 1,
      active_count: 2,
      keep_rate: 67,
    }]);
    expect(second.rows).toEqual(first.rows);
  });

  test('WITHDRAWN 캐시는 J-10 대상에서 제외한다', async () => {
    const withdrawn = await createUser(db, uniqueName('j10-withdrawn'));
    await db.asAdmin(
      `update public.users set status = 'WITHDRAWN', withdrawn_at = now() where id = $1`,
      [withdrawn],
    );
    await db.asAdmin(
      `insert into public.trust_profiles (user_id, completed_count, keep_rate)
       values ($1, 77, 77)`,
      [withdrawn],
    );
    await db.asService(`select public.lf_recompute_all_trust_profiles()`);
    const { rows } = await db.asAdmin(
      `select completed_count, keep_rate from public.trust_profiles where user_id = $1`,
      [withdrawn],
    );
    expect(rows).toEqual([{ completed_count: 77, keep_rate: 77 }]);
  });

  test('신규 함수는 빈 search_path의 SECURITY DEFINER이며 service_role만 실행한다', async () => {
    const signatures = [
      'public.lf_my_trust_profile(uuid)',
      'public.lf_trust_profile_settings_update(uuid,uuid,jsonb)',
      'public.lf_device_token_unregister(uuid,uuid,text)',
      'public.lf_recompute_all_trust_profiles()',
      'public.lf_schedule_trust_profile_recompute()',
    ];
    for (const signature of signatures) {
      const { rows } = await db.asAdmin(
        `select p.prosecdef, p.proconfig,
                has_function_privilege('anon', $1, 'EXECUTE') as anon,
                has_function_privilege('authenticated', $1, 'EXECUTE') as authenticated,
                has_function_privilege('service_role', $1, 'EXECUTE') as service_role
           from pg_catalog.pg_proc p
          where p.oid = $1::regprocedure`,
        [signature],
      );
      expect(rows).toEqual([{
        prosecdef: true,
        proconfig: ['search_path=""'],
        anon: false,
        authenticated: false,
        service_role: true,
      }]);
    }
  });

  test('J-10 cron은 중복을 교체하고 매일 03:00 KST 한 건만 남긴다', async () => {
    await db.asAdmin(
      `insert into cron.job (jobname, schedule, command)
       values ('lf-j10-trust-profile-recompute', '* * * * *', 'select 1'),
              ('lf-j10-trust-profile-recompute', '* * * * *', 'select 2')`,
    );
    await db.asService(`select public.lf_schedule_trust_profile_recompute()`);
    await db.asService(`select public.lf_schedule_trust_profile_recompute()`);
    const { rows } = await db.asAdmin(
      `select jobname, schedule, command
         from cron.job
        where jobname = 'lf-j10-trust-profile-recompute'`,
    );
    expect(rows).toEqual([{
      jobname: 'lf-j10-trust-profile-recompute',
      schedule: '0 18 * * *',
      command: 'select public.lf_recompute_all_trust_profiles();',
    }]);
  });
});
