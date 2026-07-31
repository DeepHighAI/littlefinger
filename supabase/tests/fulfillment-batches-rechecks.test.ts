import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  CHECK_DEADLINE_DAYS,
  REMINDER_SEND_HOUR_KST,
} from '../../packages/shared/src/config.ts';
import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

const ENTER_SQL =
  `select public.lf_promises_enter_checking($1::timestamptz) as payload`;
const CLOSE_SQL =
  `select public.lf_promises_close_due_checks($1::timestamptz) as payload`;
const REOPEN_SQL = `select public.lf_fulfillment_reopen(
  $1::uuid, $2::uuid, $3::uuid, $4::public.surface) as payload`;
const MIGRATION_PATH = join(
  __dirname,
  '../migrations/20260731052537_harden_fulfillment_privacy_and_lifecycle.sql',
);

let db: TestDb;

interface Fixture {
  creatorId: string;
  partnerId: string;
  promiseId: string;
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.asAdmin(sql, params);
  return rows[0] as T;
}

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function seedPromise(options: {
  status?: string;
  endDate?: string;
  roundNo?: number;
  deadline?: string;
  witness?: boolean;
} = {}): Promise<Fixture & { witnessId?: string }> {
  const creatorId = await createUser(db, `batch-creator-${randomUUID().slice(0, 8)}`);
  const partnerId = await createUser(db, `batch-partner-${randomUUID().slice(0, 8)}`);
  const witnessId = options.witness
    ? await createUser(db, `batch-witness-${randomUUID().slice(0, 8)}`)
    : undefined;
  const promiseId = await createPromise(db, {
    creatorId,
    partnerId,
    ...(witnessId === undefined ? {} : { witnessId }),
    status: options.status ?? 'ACTIVE',
  });

  await db.asAdmin(
    `update public.promises
        set current_version_id = (
              select id from public.promise_versions where promise_id = $1 and version_no = 1
            ),
            end_date = coalesce($2::date, end_date),
            check_round_no = $3,
            check_deadline_at = $4::timestamptz
      where id = $1`,
    [
      promiseId,
      options.endDate ?? null,
      options.roundNo ?? 1,
      options.deadline ?? null,
    ],
  );

  return {
    creatorId,
    partnerId,
    promiseId,
    ...(witnessId === undefined ? {} : { witnessId }),
  };
}

async function insertCheck(
  fixture: Fixture,
  actorId: string,
  roundNo: number,
  answer: 'KEPT' | 'NOT_KEPT' = 'KEPT',
): Promise<void> {
  await db.asAdmin(
    `insert into public.fulfillment_checks
       (promise_id, version_id, user_id, round_no, answer, surface)
     select id, current_version_id, $2, $3, $4::public.fulfillment_answer, 'APP'
       from public.promises where id = $1`,
    [fixture.promiseId, actorId, roundNo, answer],
  );
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('F-07 SQL 함수 보안 경계', () => {
  test('모든 이행 확인 함수가 역할별 search_path를 상속하지 않는다', async () => {
    const functionNames = [
      'lf_cancel_actor_check_reminders',
      'lf_cancel_terminal_check_reminders',
      'lf_fulfillment_reopen',
      'lf_fulfillment_submit',
      'lf_participant_promise_list',
      'lf_policy_config_int',
      'lf_promise_fulfillment_detail',
      'lf_promises_close_due_checks',
      'lf_promises_enter_checking',
      'lf_recompute_promise_trust_profiles',
      'lf_recompute_trust_profile',
      'lf_reminder_send_hour_kst',
      'lf_trust_min_sample',
    ];
    const result = await db.asAdmin(
      `select proname, proconfig
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and proname = any($1::text[])
        order by proname`,
      [functionNames],
    );
    const rows = result.rows as {
      proname: string;
      proconfig: string[] | null;
    }[];

    expect([...new Set(rows.map((row) => row.proname))]).toEqual(
      [...functionNames].sort(),
    );
    for (const row of rows) {
      expect(row.proconfig ?? []).toContain('search_path=public, pg_temp');
    }
  });
});

describe('F-07 SQL 원격 정책값', () => {
  test('spec 기본행과 단일 accessor가 shared 기본값과 같다', async () => {
    const row = await one<{
      deadline_config: number;
      hour_config: number;
      deadline_value: number;
      hour_value: number;
    }>(
      `select (select value #>> '{}' from public.app_configs
                where key = 'check_deadline_days')::int as deadline_config,
              (select value #>> '{}' from public.app_configs
                where key = 'reminder_send_hour_kst')::int as hour_config,
              public.lf_policy_config_int('check_deadline_days') as deadline_value,
              public.lf_policy_config_int('reminder_send_hour_kst') as hour_value`,
    );

    expect(row).toEqual({
      deadline_config: CHECK_DEADLINE_DAYS,
      hour_config: REMINDER_SEND_HOUR_KST,
      deadline_value: CHECK_DEADLINE_DAYS,
      hour_value: REMINDER_SEND_HOUR_KST,
    });
  });

  test('잘못된 원격값은 안전한 spec 기본값으로 돌아간다', async () => {
    await db.asAdmin(
      `update public.app_configs
          set value = case key
                        when 'check_deadline_days' then '"seven"'::jsonb
                        else '24'::jsonb
                      end
        where key in ('check_deadline_days', 'reminder_send_hour_kst')`,
    );
    try {
      const row = await one<{ deadline: number; hour: number }>(
        `select public.lf_policy_config_int('check_deadline_days') as deadline,
                public.lf_policy_config_int('reminder_send_hour_kst') as hour`,
      );
      expect(row).toEqual({
        deadline: CHECK_DEADLINE_DAYS,
        hour: REMINDER_SEND_HOUR_KST,
      });
    } finally {
      await db.asAdmin(
        `update public.app_configs
            set value = case key
                          when 'check_deadline_days' then $1::int::text::jsonb
                          else $2::int::text::jsonb
                        end
          where key in ('check_deadline_days', 'reminder_send_hour_kst')`,
        [CHECK_DEADLINE_DAYS, REMINDER_SEND_HOUR_KST],
      );
    }
  });

  test('J-02와 재확인은 원격 기한·KST 발송 시각을 같은 accessor에서 읽는다', async () => {
    await db.asAdmin(
      `update public.app_configs
          set value = case key
                        when 'check_deadline_days' then '3'::jsonb
                        else '12'::jsonb
                      end
        where key in ('check_deadline_days', 'reminder_send_hour_kst')`,
    );
    try {
      const entering = await seedPromise({ endDate: '2026-07-20' });
      await one(ENTER_SQL, ['2026-07-21T15:01:00Z']);
      const entered = await one<{
        checking_started_at: Date;
        check_deadline_at: Date;
        fire_hours: number[];
      }>(
        `select p.checking_started_at,
                p.check_deadline_at,
                array(
                  select distinct extract(
                    hour from rs.fire_at at time zone 'Asia/Seoul'
                  )::int
                    from public.reminder_schedules rs
                   where rs.promise_id = p.id
                   order by 1
                ) as fire_hours
           from public.promises p
          where p.id = $1`,
        [entering.promiseId],
      );
      expect(
        entered.check_deadline_at.getTime() - entered.checking_started_at.getTime(),
      ).toBe(3 * 24 * 60 * 60 * 1000);
      expect(entered.fire_hours).toEqual([12]);

      const reopening = await seedPromise({ status: 'DISPUTED', roundNo: 1 });
      const reopened = await one<{
        payload: { check_deadline_at: string };
        expected_deadline: Date;
      }>(
        `select payload,
                now() + interval '3 days' as expected_deadline
           from public.lf_fulfillment_reopen(
             $1::uuid, $2::uuid, $3::uuid, 'APP'
           ) payload`,
        [randomUUID(), reopening.creatorId, reopening.promiseId],
      );
      expect(new Date(reopened.payload.check_deadline_at).toISOString()).toBe(
        reopened.expected_deadline.toISOString(),
      );
      const reopenHours = await one<{ fire_hours: number[] }>(
        `select array(
                  select distinct extract(
                    hour from fire_at at time zone 'Asia/Seoul'
                  )::int
                    from public.reminder_schedules
                   where promise_id = $1 and status = 'PENDING'
                   order by 1
                ) as fire_hours`,
        [reopening.promiseId],
      );
      expect(reopenHours.fire_hours).toEqual([12]);
    } finally {
      await db.asAdmin(
        `update public.app_configs
            set value = case key
                          when 'check_deadline_days' then $1::int::text::jsonb
                          else $2::int::text::jsonb
                        end
          where key in ('check_deadline_days', 'reminder_send_hour_kst')`,
        [CHECK_DEADLINE_DAYS, REMINDER_SEND_HOUR_KST],
      );
    }
  });
});

describe('J-02/J-03 잠금 정책', () => {
  test.each([
    'lf_promises_enter_checking',
    'lf_promises_close_due_checks',
  ])('%s는 대상 행을 건너뛰지 않고 blocking FOR UPDATE로 직렬화한다', async (fn) => {
    const row = await one<{ definition: string }>(
      `select pg_get_functiondef(oid) as definition
         from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname = $1`,
      [fn],
    );
    expect(row.definition.toLowerCase()).toContain('for update');
    expect(row.definition.toLowerCase()).not.toContain('skip locked');
  });
});

describe('J-02 종료일 다음 KST 자정 CHECKING 전이', () => {
  test('UTC 세션에서도 23:59/00:00 KST 경계와 종료일 기준 시각을 지킨다', async () => {
    const previousDay = await seedPromise({ endDate: '2026-07-30' });
    const boundaryDay = await seedPromise({ endDate: '2026-07-31' });
    const timezone = await one<{ TimeZone: string }>('show time zone');
    expect(timezone.TimeZone).toBe('UTC');

    const before = await one<{
      payload: { transitioned_count: number; promise_ids: string[]; schedule_count: number };
    }>(ENTER_SQL, ['2026-07-31T14:59:59Z']);
    expect(before.payload).toEqual({
      transitioned_count: 1,
      promise_ids: [previousDay.promiseId],
      schedule_count: 6,
    });

    const previous = await one<{
      status: string;
      checking_started_at: Date;
      check_deadline_at: Date;
      check_round_no: number;
      lock_version: number;
      updated_at: Date;
    }>(
      `select status, checking_started_at, check_deadline_at, check_round_no,
              lock_version, updated_at
         from public.promises where id = $1`,
      [previousDay.promiseId],
    );
    expect(previous).toMatchObject({
      status: 'CHECKING',
      check_round_no: 1,
      lock_version: 1,
    });
    expect(previous.checking_started_at.toISOString()).toBe('2026-07-30T15:00:00.000Z');
    expect(previous.check_deadline_at.toISOString()).toBe('2026-08-06T15:00:00.000Z');
    expect(previous.updated_at.toISOString()).toBe('2026-07-31T14:59:59.000Z');

    const schedules = await db.asAdmin(
      `select kind, fire_at
         from public.reminder_schedules
        where promise_id = $1
        order by kind, user_id`,
      [previousDay.promiseId],
    );
    expect(
      schedules.rows.map((row) => [row.kind, (row.fire_at as Date).toISOString()]),
    ).toEqual([
      ['CHECK_REQ', '2026-07-31T00:00:00.000Z'],
      ['CHECK_REQ', '2026-07-31T00:00:00.000Z'],
      ['CHECK_R1', '2026-08-02T00:00:00.000Z'],
      ['CHECK_R1', '2026-08-02T00:00:00.000Z'],
      ['CHECK_R2', '2026-08-05T00:00:00.000Z'],
      ['CHECK_R2', '2026-08-05T00:00:00.000Z'],
    ]);

    expect(
      (
        await one<{ status: string }>(
          `select status from public.promises where id = $1`,
          [boundaryDay.promiseId],
        )
      ).status,
    ).toBe('ACTIVE');

    const atBoundary = await one<{
      payload: { transitioned_count: number; promise_ids: string[]; schedule_count: number };
    }>(ENTER_SQL, ['2026-07-31T15:00:00Z']);
    expect(atBoundary.payload).toEqual({
      transitioned_count: 1,
      promise_ids: [boundaryDay.promiseId],
      schedule_count: 6,
    });
  });

  test('ACTIVE만 처리하고 AMEND_PENDING은 제외하며 재실행해도 일정이 늘지 않는다', async () => {
    const active = await seedPromise({ endDate: '2026-07-20' });
    const amendPending = await seedPromise({
      status: 'AMEND_PENDING',
      endDate: '2026-07-20',
    });

    const first = await one<{
      payload: { transitioned_count: number; promise_ids: string[] };
    }>(
      ENTER_SQL,
      ['2026-07-31T15:10:00Z'],
    );
    const second = await one<{
      payload: { transitioned_count: number; promise_ids: string[] };
    }>(
      ENTER_SQL,
      ['2026-07-31T15:10:01Z'],
    );
    const rows = await one<{ count: number }>(
      `select count(*)::int as count
         from public.reminder_schedules where promise_id = $1`,
      [active.promiseId],
    );
    const excluded = await one<{ status: string }>(
      `select status from public.promises where id = $1`,
      [amendPending.promiseId],
    );

    expect(first.payload.promise_ids).toContain(active.promiseId);
    expect(first.payload.promise_ids).not.toContain(amendPending.promiseId);
    expect(second.payload.promise_ids).not.toContain(active.promiseId);
    expect(second.payload.promise_ids).not.toContain(amendPending.promiseId);
    expect(rows.count).toBe(6);
    expect(excluded.status).toBe('AMEND_PENDING');
    expect(
      await codeOf(() =>
        db.asAdmin(
          `insert into public.reminder_schedules
             (promise_id, user_id, kind, fire_at, check_round_no)
           select promise_id, user_id, kind, fire_at, check_round_no
             from public.reminder_schedules
            where promise_id = $1
            limit 1`,
          [active.promiseId],
        ),
      ),
    ).toContain('duplicate key value violates unique constraint');
  });
});

describe('J-03 기한 경과 종결', () => {
  test.each([0, 1])(
    '1라운드 응답 %s개는 UNRESOLVED와 양측 NT-14를 한 번만 만든다',
    async (responseCount) => {
      const fixture = await seedPromise({
        status: 'CHECKING',
        roundNo: 1,
        deadline: '2026-08-01T00:00:00Z',
      });
      if (responseCount === 1) await insertCheck(fixture, fixture.creatorId, 1);
      await db.asAdmin(
        `insert into public.reminder_schedules
           (promise_id, user_id, kind, fire_at)
         values ($1, $2, 'CHECK_R2', '2026-08-01T00:00:00Z')`,
        [fixture.promiseId, fixture.creatorId],
      );

      const first = await one<{
        payload: { transitioned_count: number; transitions: Array<Record<string, unknown>> };
      }>(CLOSE_SQL, ['2026-08-08T00:00:00Z']);
      const second = await one<{ payload: { transitioned_count: number } }>(
        CLOSE_SQL,
        ['2026-08-08T00:00:01Z'],
      );
      const state = await one<{
        status: string;
        closed_at: Date;
        pending: number;
        profiles: number;
        lock_version: number;
        updated_at: Date;
      }>(
        `select p.status, p.closed_at, p.lock_version, p.updated_at,
                (select count(*)::int from public.reminder_schedules
                  where promise_id = p.id and status = 'PENDING') as pending,
                (select count(*)::int from public.trust_profiles
                  where user_id in ($2, $3)) as profiles
           from public.promises p where p.id = $1`,
        [fixture.promiseId, fixture.creatorId, fixture.partnerId],
      );
      const notifications = await db.asAdmin(
        `select user_id, type, channel, title, body, deeplink, status, sent_at, dedupe_key
           from public.notifications
          where promise_id = $1
          order by user_id`,
        [fixture.promiseId],
      );

      expect(first.payload.transitions).toContainEqual({
        promise_id: fixture.promiseId,
        status: 'UNRESOLVED',
        round_no: 1,
        notification_count: 2,
      });
      expect(
        (second.payload as { transitions?: Array<{ promise_id: string }> }).transitions ?? [],
      ).not.toContainEqual(expect.objectContaining({ promise_id: fixture.promiseId }));
      expect(state).toMatchObject({
        status: 'UNRESOLVED',
        pending: 0,
        profiles: 2,
        lock_version: 1,
      });
      expect(state.closed_at.toISOString()).toBe('2026-08-08T00:00:00.000Z');
      expect(state.updated_at.toISOString()).toBe('2026-08-08T00:00:00.000Z');
      expect(notifications.rows).toHaveLength(2);
      for (const row of notifications.rows) {
        expect(row).toMatchObject({
          type: 'NT-14',
          channel: 'INAPP',
          title: '이행 확인 없이 종결됐어요',
          body: '매일 걷기',
          deeplink: 'SCR-A05',
          status: 'SENT',
        });
        expect((row.sent_at as Date).toISOString()).toBe('2026-08-08T00:00:00.000Z');
        expect(String(row.dedupe_key)).toMatch(
          new RegExp(`^${fixture.promiseId}:NT-14:.*:INAPP:1:20260808$`, 'u'),
        );
      }
    },
  );

  test.each([0, 1])(
    '재확인 라운드 응답 %s개는 DISPUTED와 수락 참여자 NT-13을 한 번만 만든다',
    async (responseCount) => {
      const fixture = await seedPromise({
        status: 'CHECKING',
        roundNo: 2,
        deadline: '2026-08-01T00:00:00Z',
        witness: true,
      });
      if (responseCount === 1) await insertCheck(fixture, fixture.partnerId, 2);
      await db.asAdmin(
        `insert into public.reminder_schedules
           (promise_id, user_id, kind, fire_at, check_round_no)
         values ($1, $2, 'CHECK_R1', '2026-08-02T00:00:00Z', 2)`,
        [fixture.promiseId, fixture.creatorId],
      );

      await one(CLOSE_SQL, ['2026-08-08T01:00:00Z']);
      await one(CLOSE_SQL, ['2026-08-08T01:00:01Z']);
      const state = await one<{
        status: string;
        closed_at: Date | null;
        profiles: number;
        pending: number;
      }>(
        `select p.status, p.closed_at,
                (select count(*)::int from public.trust_profiles
                  where user_id in ($2, $3)) as profiles,
                (select count(*)::int from public.reminder_schedules
                  where promise_id = p.id and status = 'PENDING') as pending
           from public.promises p where p.id = $1`,
        [fixture.promiseId, fixture.creatorId, fixture.partnerId],
      );
      const notifications = await db.asAdmin(
        `select user_id, type, channel, title, body, deeplink, status, dedupe_key
           from public.notifications
          where promise_id = $1
          order by user_id`,
        [fixture.promiseId],
      );

      expect(state).toEqual({
        status: 'DISPUTED',
        closed_at: null,
        profiles: 2,
        pending: 0,
      });
      expect(notifications.rows).toHaveLength(3);
      expect(notifications.rows.map((row) => row.user_id).sort()).toEqual(
        [fixture.creatorId, fixture.partnerId, fixture.witnessId].sort(),
      );
      for (const row of notifications.rows) {
        expect(row).toMatchObject({
          type: 'NT-13',
          channel: 'INAPP',
          title: '두 분의 확인이 서로 달라요',
          body: '매일 걷기',
          deeplink: 'SCR-A05',
          status: 'SENT',
        });
        expect(String(row.dedupe_key)).toMatch(
          new RegExp(`^${fixture.promiseId}:NT-13:.*:INAPP:2:20260808$`, 'u'),
        );
      }
    },
  );

  test('기한이 지났어도 현재 라운드 응답이 둘이면 아무 것도 바꾸지 않는다', async () => {
    const fixture = await seedPromise({
      status: 'CHECKING',
      roundNo: 2,
      deadline: '2026-08-01T00:00:00Z',
    });
    await insertCheck(fixture, fixture.creatorId, 2, 'KEPT');
    await insertCheck(fixture, fixture.partnerId, 2, 'NOT_KEPT');

    const result = await one<{ payload: { transitioned_count: number } }>(
      CLOSE_SQL,
      ['2026-08-08T00:00:00Z'],
    );
    const row = await one<{ status: string; notifications: number }>(
      `select p.status,
              (select count(*)::int from public.notifications where promise_id = p.id)
                as notifications
         from public.promises p where p.id = $1`,
      [fixture.promiseId],
    );

    expect(result.payload.transitioned_count).toBe(0);
    expect(row).toEqual({ status: 'CHECKING', notifications: 0 });
  });
});

describe('DISPUTED 재확인 라운드', () => {
  test('참여 권한·상태를 검사하고 같은 키 재생은 첫 응답을 돌려준다', async () => {
    const fixture = await seedPromise({ status: 'DISPUTED', roundNo: 1 });
    const stranger = await createUser(db, `reopen-stranger-${randomUUID().slice(0, 8)}`);
    expect(
      await codeOf(() =>
        db.asAdmin(REOPEN_SQL, [
          randomUUID(),
          stranger,
          fixture.promiseId,
          'APP',
        ]),
      ),
    ).toBe('E_NOT_FOUND');

    const active = await seedPromise({ status: 'ACTIVE' });
    expect(
      await codeOf(() =>
        db.asAdmin(REOPEN_SQL, [
          randomUUID(),
          active.creatorId,
          active.promiseId,
          'APP',
        ]),
      ),
    ).toBe('E_STATE_CONFLICT');

    await insertCheck(fixture, fixture.creatorId, 1, 'KEPT');
    await insertCheck(fixture, fixture.partnerId, 1, 'NOT_KEPT');
    await db.asAdmin(
      `select public.lf_recompute_promise_trust_profiles($1::uuid)`,
      [fixture.promiseId],
    );
    await db.asAdmin(
      `update public.promises set closed_at = now() - interval '1 day' where id = $1`,
      [fixture.promiseId],
    );
    await db.asAdmin(
      `insert into public.reminder_schedules
         (promise_id, user_id, kind, fire_at, check_round_no)
       values ($1, $2, 'CHECK_R1', now() + interval '1 day', 1)`,
      [fixture.promiseId, fixture.creatorId],
    );
    const key = randomUUID();
    const first = await one<{
      payload: {
        promise_id: string;
        status: string;
        round_no: number;
        check_deadline_at: string;
        title: string;
        notification_recipients: Array<{ user_id: string; role: string }>;
      };
      expected_deadline: Date;
    }>(
      `select payload,
              now() + interval '7 days' as expected_deadline
         from public.lf_fulfillment_reopen(
           $1::uuid, $2::uuid, $3::uuid, $4::public.surface
         ) payload`,
      [key, fixture.creatorId, fixture.promiseId, 'APP'],
    );
    const replay = await one<{ payload: Record<string, unknown> }>(REOPEN_SQL, [
      key,
      fixture.creatorId,
      fixture.promiseId,
      'WEB',
    ]);
    const stored = await one<{
      status: string;
      check_round_no: number;
      check_deadline_at: Date;
      checks: number;
      pending: number;
      canceled: number;
      closed_at: Date | null;
      lock_version: number;
      profiles: Array<{
        user_id: string;
        disputed_count: number;
        active_count: number;
      }>;
    }>(
      `select p.status, p.check_round_no, p.check_deadline_at, p.closed_at, p.lock_version,
              (select count(*)::int from public.fulfillment_checks
                where promise_id = p.id) as checks,
              (select count(*)::int from public.reminder_schedules
                where promise_id = p.id and status = 'PENDING') as pending,
              (select count(*)::int from public.reminder_schedules
                where promise_id = p.id and status = 'CANCELED') as canceled,
              (select jsonb_agg(
                        jsonb_build_object(
                          'user_id', tp.user_id,
                          'disputed_count', tp.disputed_count,
                          'active_count', tp.active_count
                        )
                        order by tp.user_id
                      )
                 from public.trust_profiles tp
                where tp.user_id in ($2, $3)) as profiles
         from public.promises p where p.id = $1`,
      [fixture.promiseId, fixture.creatorId, fixture.partnerId],
    );

    expect(first.payload).toMatchObject({
      promise_id: fixture.promiseId,
      status: 'CHECKING',
      round_no: 2,
      title: '매일 걷기',
      notification_recipients: [{ user_id: fixture.partnerId, role: 'PARTNER' }],
    });
    expect(new Date(first.payload.check_deadline_at).toISOString()).toBe(
      first.expected_deadline.toISOString(),
    );
    expect(replay.payload).toEqual(first.payload);
    expect(stored).toMatchObject({
      status: 'CHECKING',
      check_round_no: 2,
      checks: 2,
      pending: 4,
      canceled: 1,
      closed_at: null,
      lock_version: 1,
    });
    expect(stored.profiles).toEqual(
      [fixture.creatorId, fixture.partnerId]
        .sort()
        .map((userId) => ({
          user_id: userId,
          disputed_count: 0,
          active_count: 1,
        })),
    );
    expect(stored.check_deadline_at.toISOString()).toBe(first.expected_deadline.toISOString());

    const scheduleTimes = await db.asAdmin(
      `select distinct kind, fire_at
         from public.reminder_schedules
        where promise_id = $1 and status = 'PENDING'
        order by kind`,
      [fixture.promiseId],
    );
    const expectedTimes = await db.asAdmin(
      `select 'CHECK_R1' as kind,
              (((now() at time zone 'Asia/Seoul')::date + 2 + time '09:00')
                at time zone 'Asia/Seoul') as fire_at
       union all
       select 'CHECK_R2',
              (((now() at time zone 'Asia/Seoul')::date + 5 + time '09:00')
                at time zone 'Asia/Seoul')`,
    );
    expect(scheduleTimes.rows).toEqual(expectedTimes.rows);
  });

  test('서로 다른 키의 동시 재확인은 한 요청만 새 라운드를 만든다', async () => {
    const fixture = await seedPromise({ status: 'DISPUTED', roundNo: 4 });
    const results = await Promise.allSettled([
      db.asAdmin(REOPEN_SQL, [
        randomUUID(),
        fixture.creatorId,
        fixture.promiseId,
        'APP',
      ]),
      db.asAdmin(REOPEN_SQL, [
        randomUUID(),
        fixture.partnerId,
        fixture.promiseId,
        'WEB',
      ]),
    ]);
    const stored = await one<{ check_round_no: number; schedules: number }>(
      `select p.check_round_no,
              (select count(*)::int from public.reminder_schedules
                where promise_id = p.id and status = 'PENDING') as schedules
         from public.promises p where p.id = $1`,
      [fixture.promiseId],
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(stored).toEqual({ check_round_no: 5, schedules: 4 });
  });
});

describe('배치 스케줄과 서버 전용 권한', () => {
  test('J-02/J-03은 정확한 GMT 표현식으로 하나씩 등록되고 재적용에도 중복되지 않는다', async () => {
    const expected = [
      {
        jobname: 'lf-promises-close-due-checks',
        schedule: '20 15 * * *',
        command: 'select public.lf_promises_close_due_checks();',
      },
      {
        jobname: 'lf-promises-enter-checking',
        schedule: '10 15 * * *',
        command: 'select public.lf_promises_enter_checking();',
      },
    ];
    expect(
      (
        await db.asAdmin(
          `select jobname, schedule, command
             from cron.job
            where jobname in (
              'lf-promises-close-due-checks',
              'lf-promises-enter-checking'
            )
            order by jobname`,
        )
      ).rows,
    ).toEqual(expected);

    await db.execAdmin(readFileSync(MIGRATION_PATH, 'utf8'));
    expect(
      (
        await db.asAdmin(
          `select jobname, schedule, command
             from cron.job
            where jobname in (
              'lf-promises-close-due-checks',
              'lf-promises-enter-checking'
            )
            order by jobname`,
        )
      ).rows,
    ).toEqual(expected);
  });

  test.each([
    'public.lf_promises_enter_checking(timestamp with time zone)',
    'public.lf_promises_close_due_checks(timestamp with time zone)',
    'public.lf_fulfillment_reopen(uuid,uuid,uuid,public.surface)',
  ])('%s는 anon/authenticated가 실행할 수 없다', async (fn) => {
    const row = await one<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
              has_function_privilege('authenticated', $1, 'EXECUTE') as authenticated`,
      [fn],
    );
    expect(row).toEqual({ anon: false, authenticated: false });
  });
});
