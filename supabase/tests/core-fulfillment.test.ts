import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { TRUST_MIN_SAMPLE } from '../../packages/shared/src/config.ts';
import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

const LIST_SQL = `select public.lf_participant_promise_list($1::uuid) as payload`;
const DETAIL_SQL = `select public.lf_promise_fulfillment_detail(
  $1::uuid, $2::uuid) as payload`;
const SUBMIT_SQL = `select public.lf_fulfillment_submit(
  $1::uuid, $2::uuid, $3::uuid, $4::public.fulfillment_answer,
  $5::text, $6::boolean, $7::public.surface) as payload`;

let db: TestDb;

interface Fixture {
  creatorId: string;
  partnerId: string;
  promiseId: string;
}

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.asAdmin(sql, params);
  return rows[0] as T;
}

async function seedChecking(options: {
  status?: string;
  deadline?: 'open' | 'expired';
  keeper?: 'CREATOR' | 'PARTNER' | 'BOTH';
  roundNo?: number;
} = {}): Promise<Fixture> {
  const creatorId = await createUser(db, `creator-${randomUUID().slice(0, 8)}`);
  const partnerId = await createUser(db, `partner-${randomUUID().slice(0, 8)}`);
  const promiseId = await createPromise(db, {
    creatorId,
    partnerId,
    status: options.status ?? 'CHECKING',
  });

  await db.asAdmin(
    `update public.promise_versions
        set activated_at = now() - interval '8 days'
      where promise_id = $1`,
    [promiseId],
  );
  await db.asAdmin(
    `update public.promises
        set current_version_id = (
              select id from public.promise_versions where promise_id = $1 and version_no = 1
            ),
            keeper = $2::public.keeper,
            activated_at = now() - interval '8 days',
            checking_started_at = now() - interval '1 day',
            check_deadline_at = case when $3 = 'expired'
                                     then now() - interval '1 second'
                                     else now() + interval '1 day' end,
            check_round_no = $4
      where id = $1`,
    [promiseId, options.keeper ?? 'BOTH', options.deadline ?? 'open', options.roundNo ?? 1],
  );

  return { creatorId, partnerId, promiseId };
}

async function submit(
  fixture: Fixture,
  actorId: string,
  answer: 'KEPT' | 'NOT_KEPT',
  options: { key?: string; comment?: string | null; revise?: boolean } = {},
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(SUBMIT_SQL, [
    options.key ?? randomUUID(),
    actorId,
    fixture.promiseId,
    answer,
    options.comment ?? null,
    options.revise ?? false,
    'APP',
  ]);
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

async function insertCheck(
  fixture: Fixture,
  actorId: string,
  answer: 'KEPT' | 'NOT_KEPT',
  roundNo = 1,
  comment: string | null = null,
): Promise<void> {
  await db.asAdmin(
    `insert into public.fulfillment_checks
       (promise_id, version_id, user_id, round_no, answer, comment, surface)
     select $1, current_version_id, $2, $3, $4::public.fulfillment_answer, $5, 'APP'
       from public.promises where id = $1`,
    [fixture.promiseId, actorId, roundNo, answer, comment],
  );
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('참여 약속 목록', () => {
  test('JOINED CREATOR/PARTNER의 대상 상태만 반환하고 숨긴 행과 PENDING은 제외한다', async () => {
    const actor = await createUser(db, `list-${randomUUID().slice(0, 8)}`);
    const statuses = [
      'ACTIVE',
      'AMEND_PENDING',
      'CHECKING',
      'COMPLETED',
      'BROKEN',
      'DISPUTED',
      'UNRESOLVED',
      'CANCELED',
      'DECLINED',
    ] as const;

    const ids: string[] = [];
    for (const status of statuses) {
      ids.push(await createPromise(db, { creatorId: actor, status }));
    }
    await createPromise(db, { creatorId: actor, status: 'PENDING' });
    const hidden = await createPromise(db, { creatorId: actor, status: 'ACTIVE' });
    await db.asAdmin(`update public.promises set hidden_by = jsonb_build_array($2::text) where id = $1`, [
      hidden,
      actor,
    ]);

    const row = await one<{ payload: Array<{ promise_id: string; status: string }> }>(LIST_SQL, [
      actor,
    ]);
    expect(row.payload.map((item) => item.promise_id).sort()).toEqual(ids.sort());
    expect(row.payload.map((item) => item.status).sort()).toEqual([...statuses].sort());
  });

  test('현재 라운드 응답 여부를 계산하고 내 응답 필요 행을 먼저 둔다', async () => {
    const actor = await createUser(db, `order-${randomUUID().slice(0, 8)}`);
    const partner = await createUser(db, `order-partner-${randomUUID().slice(0, 8)}`);
    const needs = await createPromise(db, { creatorId: actor, partnerId: partner, status: 'CHECKING' });
    const waits = await createPromise(db, { creatorId: actor, partnerId: partner, status: 'CHECKING' });
    for (const promiseId of [needs, waits]) {
      await db.asAdmin(
        `update public.promises
            set current_version_id = (select id from public.promise_versions where promise_id = $1),
                check_deadline_at = now() + interval '1 day'
          where id = $1`,
        [promiseId],
      );
    }
    await db.asAdmin(
      `insert into public.fulfillment_checks
         (promise_id, version_id, user_id, answer, surface)
       select id, current_version_id, $2, 'KEPT', 'APP' from public.promises where id = $1`,
      [waits, actor],
    );

    const row = await one<{
      payload: Array<{
        promise_id: string;
        needs_response: boolean;
        waiting_for_partner: boolean;
      }>;
    }>(LIST_SQL, [actor]);

    expect(row.payload.slice(0, 2)).toEqual([
      expect.objectContaining({
        promise_id: needs,
        needs_response: true,
        waiting_for_partner: false,
      }),
      expect.objectContaining({
        promise_id: waits,
        needs_response: false,
        waiting_for_partner: true,
      }),
    ]);
  });
});

describe('이행 상세 읽기', () => {
  test('비참여자와 JOINED가 아닌 참여자는 존재를 알 수 없다', async () => {
    const fixture = await seedChecking();
    const stranger = await createUser(db, `stranger-${randomUUID().slice(0, 8)}`);
    expect(await codeOf(() => db.asAdmin(DETAIL_SQL, [stranger, fixture.promiseId]))).toBe(
      'E_NOT_FOUND',
    );

    await db.asAdmin(
      `update public.promise_participants set status = 'INVITED'
        where promise_id = $1 and user_id = $2`,
      [fixture.promiseId, fixture.partnerId],
    );
    expect(await codeOf(() => db.asAdmin(DETAIL_SQL, [fixture.partnerId, fixture.promiseId]))).toBe(
      'E_NOT_FOUND',
    );
  });

  test('내가 제출하기 전에는 상대 응답 존재만 보이고 답변은 숨긴다', async () => {
    const fixture = await seedChecking();
    await insertCheck(fixture, fixture.partnerId, 'NOT_KEPT', 1, '상대 의견');

    const before = await one<{
      payload: {
        my_check: null;
        partner_has_submitted: boolean;
        partner_check: null;
      };
    }>(DETAIL_SQL, [fixture.creatorId, fixture.promiseId]);
    expect(before.payload).toMatchObject({
      my_check: null,
      partner_has_submitted: true,
      partner_check: null,
    });

    await insertCheck(fixture, fixture.creatorId, 'KEPT', 1, '내 의견');
    const after = await one<{
      payload: {
        my_check: { answer: string };
        partner_check: { answer: string; comment: string };
      };
    }>(DETAIL_SQL, [fixture.creatorId, fixture.promiseId]);
    expect(after.payload.my_check.answer).toBe('KEPT');
    expect(after.payload.partner_check).toMatchObject({
      answer: 'NOT_KEPT',
      comment: '상대 의견',
    });
  });

  test('지난 라운드는 양측 주장을 같은 형태로 공개한다', async () => {
    const fixture = await seedChecking({ roundNo: 2 });
    await insertCheck(fixture, fixture.creatorId, 'KEPT', 1, '작성자 주장');
    await insertCheck(fixture, fixture.partnerId, 'NOT_KEPT', 1, '상대방 주장');

    const row = await one<{
      payload: {
        history: Array<{
          round_no: number;
          creator_check: { answer: string };
          partner_check: { answer: string };
        }>;
      };
    }>(DETAIL_SQL, [fixture.creatorId, fixture.promiseId]);
    expect(row.payload.history).toEqual([
      expect.objectContaining({
        round_no: 1,
        creator_check: expect.objectContaining({ answer: 'KEPT' }),
        partner_check: expect.objectContaining({ answer: 'NOT_KEPT' }),
      }),
    ]);
  });
});

describe('이행 응답 제출과 정정', () => {
  test('CHECKING 전과 기한 경과 뒤 제출은 E_STATE_CONFLICT다', async () => {
    const active = await seedChecking({ status: 'ACTIVE' });
    expect(await codeOf(() => submit(active, active.creatorId, 'KEPT'))).toBe('E_STATE_CONFLICT');

    const expired = await seedChecking({ deadline: 'expired' });
    expect(await codeOf(() => submit(expired, expired.creatorId, 'KEPT'))).toBe(
      'E_STATE_CONFLICT',
    );
  });

  test('의견은 제어문자 제거 후 NFC로 저장하고 200/201 코드포인트 경계를 지킨다', async () => {
    const normalized = await seedChecking();
    await submit(normalized, normalized.creatorId, 'KEPT', {
      comment: ` \u1100\u0001\u1161 `,
    });
    const stored = await one<{ comment: string }>(
      `select comment from public.fulfillment_checks where promise_id = $1 and user_id = $2`,
      [normalized.promiseId, normalized.creatorId],
    );
    expect(stored.comment).toBe('가');

    const max = await seedChecking();
    expect(
      await codeOf(() => submit(max, max.creatorId, 'KEPT', { comment: '가'.repeat(200) })),
    ).toBeNull();

    const tooLong = await seedChecking();
    expect(
      await codeOf(() =>
        submit(tooLong, tooLong.creatorId, 'KEPT', { comment: '가'.repeat(201) }),
      ),
    ).toBe('E_VALIDATION');
  });

  test('첫 제출·같은 키 재생·명시적 1회 정정만 허용한다', async () => {
    const fixture = await seedChecking();
    const key = randomUUID();
    const first = await submit(fixture, fixture.creatorId, 'KEPT', {
      key,
      comment: '첫 의견',
    });
    expect(first).toMatchObject({
      promise_id: fixture.promiseId,
      status: 'CHECKING',
      round_no: 1,
      revised_at: null,
      waiting_for_partner: true,
      title: '매일 걷기',
      notification_recipients: expect.arrayContaining([
        { user_id: fixture.creatorId, role: 'CREATOR' },
        { user_id: fixture.partnerId, role: 'PARTNER' },
      ]),
    });
    expect(await submit(fixture, fixture.creatorId, 'KEPT', { key, comment: '다른 내용' })).toEqual(
      first,
    );
    expect(await codeOf(() => submit(fixture, fixture.creatorId, 'KEPT'))).toBe(
      'E_STATE_CONFLICT',
    );

    const revised = await submit(fixture, fixture.creatorId, 'NOT_KEPT', {
      revise: true,
      comment: '정정 의견',
    });
    expect(revised).toMatchObject({
      status: 'CHECKING',
      waiting_for_partner: true,
    });
    expect(revised.revised_at).not.toBeNull();
    expect(
      await codeOf(() =>
        submit(fixture, fixture.creatorId, 'KEPT', { revise: true, comment: '두 번째 정정' }),
      ),
    ).toBe('E_STATE_CONFLICT');

    const row = await one<{ count: number; answer: string; comment: string }>(
      `select count(*)::int as count, max(answer::text) as answer, max(comment) as comment
         from public.fulfillment_checks where promise_id = $1 and user_id = $2`,
      [fixture.promiseId, fixture.creatorId],
    );
    expect(row).toEqual({ count: 1, answer: 'NOT_KEPT', comment: '정정 의견' });
  });

  test('상대 응답 뒤에는 정정할 수 없다', async () => {
    const fixture = await seedChecking();
    await submit(fixture, fixture.creatorId, 'KEPT');
    await submit(fixture, fixture.partnerId, 'KEPT');
    expect(
      await codeOf(() => submit(fixture, fixture.creatorId, 'NOT_KEPT', { revise: true })),
    ).toBe('E_STATE_CONFLICT');
  });
});

describe('두 응답의 트랜잭션 판정', () => {
  test.each([
    ['KEPT', 'KEPT', 'COMPLETED', 1],
    ['NOT_KEPT', 'NOT_KEPT', 'BROKEN', 0],
    ['KEPT', 'NOT_KEPT', 'DISPUTED', 0],
  ] as const)(
    '%s + %s는 %s로 한 번만 전이하고 완료 지표 증가량은 %s다',
    async (creatorAnswer, partnerAnswer, expectedStatus, expectedMetricDelta) => {
      const fixture = await seedChecking();
      await db.asAdmin(
        `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
         values ($1, $2, 'CHECK_R1', now() + interval '1 hour')`,
        [fixture.promiseId, fixture.creatorId],
      );
      const before = await one<{ count: number }>(
        `select coalesce(sum(completed_count), 0)::int as count from public.daily_metrics`,
      );

      const responses = await Promise.all([
        submit(fixture, fixture.creatorId, creatorAnswer),
        submit(fixture, fixture.partnerId, partnerAnswer),
      ]);

      const row = await one<{
        status: string;
        closed_at: Date | null;
        checks: number;
        metric: number;
        pending_reminders: number;
        profiles: number;
      }>(
        `select p.status, p.closed_at,
                (select count(*)::int from public.fulfillment_checks where promise_id = p.id) as checks,
                (select coalesce(sum(completed_count), 0)::int from public.daily_metrics) as metric,
                (select count(*)::int from public.reminder_schedules
                  where promise_id = p.id and status = 'PENDING') as pending_reminders,
                (select count(*)::int
                   from public.trust_profiles tp
                  where tp.user_id in ($2, $3)) as profiles
           from public.promises p where p.id = $1`,
        [fixture.promiseId, fixture.creatorId, fixture.partnerId],
      );
      expect(row.status).toBe(expectedStatus);
      expect(row.checks).toBe(2);
      expect(row.metric - before.count).toBe(expectedMetricDelta);
      expect(row.closed_at === null).toBe(expectedStatus === 'DISPUTED');
      expect(row.pending_reminders).toBe(expectedStatus === 'DISPUTED' ? 1 : 0);
      expect(row.profiles).toBe(2);
      expect(responses.map((response) => response.status)).toContain(expectedStatus);
    },
  );
});

describe('신뢰 프로필 재계산', () => {
  test('keeper 역할과 BOTH를 적용하고 최소 표본·분쟁·미확정 건수를 분리한다', async () => {
    const actor = await createUser(db, `trust-${randomUUID().slice(0, 8)}`);
    const other = await createUser(db, `trust-other-${randomUUID().slice(0, 8)}`);

    async function add(
      status: string,
      role: 'CREATOR' | 'PARTNER',
      keeper: 'CREATOR' | 'PARTNER' | 'BOTH',
    ): Promise<void> {
      const promiseId =
        role === 'CREATOR'
          ? await createPromise(db, { creatorId: actor, partnerId: other, status })
          : await createPromise(db, { creatorId: other, partnerId: actor, status });
      await db.asAdmin(`update public.promises set keeper = $2::public.keeper where id = $1`, [
        promiseId,
        keeper,
      ]);
    }

    await add('COMPLETED', 'CREATOR', 'CREATOR');
    await add('COMPLETED', 'PARTNER', 'PARTNER');
    await add('BROKEN', 'CREATOR', 'BOTH');
    await add('BROKEN', 'CREATOR', 'PARTNER');
    await add('DISPUTED', 'CREATOR', 'PARTNER');
    await add('UNRESOLVED', 'PARTNER', 'CREATOR');
    await add('CHECKING', 'PARTNER', 'BOTH');

    await db.asAdmin(`select public.lf_recompute_trust_profile($1::uuid)`, [actor]);
    const profile = await one<{
      completed_count: number;
      broken_count: number;
      disputed_count: number;
      unresolved_count: number;
      active_count: number;
      keep_rate: number;
    }>(`select * from public.trust_profiles where user_id = $1`, [actor]);
    expect(profile).toMatchObject({
      completed_count: 2,
      broken_count: 1,
      disputed_count: 1,
      unresolved_count: 1,
      active_count: 1,
      keep_rate: 67,
    });

    const small = await createUser(db, `trust-small-${randomUUID().slice(0, 8)}`);
    for (let index = 0; index < TRUST_MIN_SAMPLE - 1; index += 1) {
      await createPromise(db, { creatorId: small, partnerId: other, status: 'COMPLETED' });
    }
    await db.asAdmin(`select public.lf_recompute_trust_profile($1::uuid)`, [small]);
    const smallProfile = await one<{ keep_rate: number | null }>(
      `select keep_rate from public.trust_profiles where user_id = $1`,
      [small],
    );
    expect(smallProfile.keep_rate).toBeNull();
  });

  test('SQL 최소 표본은 공유 설정과 같다', async () => {
    const row = await one<{ value: number }>(
      `select public.lf_trust_min_sample() as value`,
    );
    expect(row.value).toBe(TRUST_MIN_SAMPLE);
  });
});

describe('서버 전용 실행 권한', () => {
  const SERVER_ONLY = [
    'public.lf_trust_min_sample()',
    'public.lf_participant_promise_list(uuid)',
    'public.lf_promise_fulfillment_detail(uuid,uuid)',
    'public.lf_recompute_trust_profile(uuid)',
    'public.lf_fulfillment_submit(uuid,uuid,uuid,public.fulfillment_answer,text,boolean,public.surface)',
  ] as const;

  test.each(
    SERVER_ONLY.flatMap((fn) =>
      (['anon', 'authenticated'] as const).map((role) => [fn, role] as const),
    ),
  )('%s에 %s 실행 권한이 없다', async (fn, role) => {
    const row = await one<{ allowed: boolean }>(
      `select has_function_privilege($1, $2, 'execute') as allowed`,
      [role, fn],
    );
    expect(row.allowed).toBe(false);
  });

  test.each(SERVER_ONLY)('%s는 service_role이 실행할 수 있다', async (fn) => {
    const row = await one<{ allowed: boolean }>(
      `select has_function_privilege('service_role', $1, 'execute') as allowed`,
      [fn],
    );
    expect(row.allowed).toBe(true);
  });
});
