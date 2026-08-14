import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  createInvitation,
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

let db: TestDb;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.asAdmin(sql, params);
  return rows[0] as T;
}

async function enqueue(input: {
  userId: string;
  promiseId: string;
  event?: string;
  scope?: string;
  now?: string;
}): Promise<string> {
  const row = await one<{ id: string }>(
    `select public.lf_notification_outbox_enqueue(
       $1::uuid, $2::uuid, $3, $4::jsonb, $5, $6::timestamptz
     )::text as id`,
    [
      input.userId,
      input.promiseId,
      input.event ?? 'NT-07',
      JSON.stringify({ promiseTitle: '매일 걷기' }),
      input.scope ?? randomUUID(),
      input.now ?? '2030-01-01T00:00:00.000Z',
    ],
  );
  return row.id;
}

async function claim(now: string): Promise<Record<string, unknown>[]> {
  const row = await one<{ result: Record<string, unknown>[] }>(
    `select public.lf_notification_outbox_claim($1::timestamptz, 100, 30) as result`,
    [now],
  );
  return row.result;
}

async function record(input: {
  id: string;
  leaseId: string;
  success: boolean;
  now: string;
  body?: string | null;
}): Promise<Record<string, unknown>> {
  const row = await one<{ result: Record<string, unknown> }>(
    `select public.lf_notification_outbox_record(
       $1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz
     ) as result`,
    [
      input.id,
      input.leaseId,
      input.success,
      input.body ?? null,
      input.success ? null : 'FANOUT_FAILED',
      input.now,
    ],
  );
  return row.result;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.asAdmin(`delete from public.notification_outbox`);
});

describe('notification_outbox 내구성 경계', () => {
  test('같은 논리 이벤트를 두 번 enqueue해도 intent는 하나다', async () => {
    const userId = await createUser(db, '아웃박스중복');
    const promiseId = await createPromise(db, { creatorId: userId });
    const scope = randomUUID();

    const first = await enqueue({ userId, promiseId, scope });
    const second = await enqueue({ userId, promiseId, scope });

    expect(second).toBe(first);
    const count = await one<{ count: number }>(
      `select count(*)::int as count from public.notification_outbox where promise_id = $1`,
      [promiseId],
    );
    expect(count.count).toBe(1);
  });

  test('claim은 lease를 부여하고 성공 record는 본문 스냅샷과 함께 종결한다', async () => {
    const userId = await createUser(db, '아웃박스성공');
    const promiseId = await createPromise(db, { creatorId: userId });
    const now = '2026-08-14T00:00:00.000Z';
    const id = await enqueue({ userId, promiseId, now });

    const [leased] = await claim(now);
    expect(leased).toMatchObject({ id, status: 'LEASED', attempt_count: 1 });

    const result = await record({
      id,
      leaseId: String(leased?.['lease_id']),
      success: true,
      now,
      body: '매일 걷기',
    });
    expect(result).toMatchObject({ status: 'PROCESSED', attempt_count: 1 });

    const saved = await one<{ body_snapshot: string; processed_at: string }>(
      `select body_snapshot, processed_at::text from public.notification_outbox where id = $1`,
      [id],
    );
    expect(saved.body_snapshot).toBe('매일 걷기');
    expect(saved.processed_at).not.toBeNull();
  });

  test('실패 간격은 60초, 300초, 900초이고 네 번째 실패 뒤 FAILED다', async () => {
    const userId = await createUser(db, '아웃박스재시도');
    const promiseId = await createPromise(db, { creatorId: userId });
    const instants = [
      '2026-08-14T01:00:00.000Z',
      '2026-08-14T01:01:00.000Z',
      '2026-08-14T01:06:00.000Z',
      '2026-08-14T01:21:00.000Z',
    ];
    const id = await enqueue({ userId, promiseId, now: instants[0] as string });
    const expectedNext = [
      '2026-08-14T01:01:00+00:00',
      '2026-08-14T01:06:00+00:00',
      '2026-08-14T01:21:00+00:00',
    ];

    for (let index = 0; index < instants.length; index += 1) {
      const [leased] = await claim(instants[index] as string);
      expect(leased).toMatchObject({ id, attempt_count: index + 1 });
      const result = await record({
        id,
        leaseId: String(leased?.['lease_id']),
        success: false,
        now: instants[index] as string,
        body: '매일 걷기',
      });
      if (index < 3) {
        expect(result).toMatchObject({
          status: 'PENDING',
          next_attempt_at: expectedNext[index],
        });
      } else {
        expect(result).toMatchObject({ status: 'FAILED', attempt_count: 4 });
      }
    }
  });

  test('FAILED는 claim되지 않고 내부 requeue 뒤에만 다시 처리된다', async () => {
    const userId = await createUser(db, '아웃박스재큐');
    const promiseId = await createPromise(db, { creatorId: userId });
    const id = await enqueue({ userId, promiseId, now: '2026-08-15T00:00:00.000Z' });
    await db.asAdmin(
      `update public.notification_outbox
          set status = 'FAILED', attempt_count = 4, failed_at = now()
        where id = $1`,
      [id],
    );

    expect((await claim('2026-08-15T00:00:00.000Z')).some((row) => row['id'] === id)).toBe(false);
    const requeued = await one<{ result: Record<string, unknown> }>(
      `select public.lf_notification_outbox_requeue($1::uuid, $2::timestamptz) as result`,
      [id, '2026-08-15T00:00:00.000Z'],
    );
    expect(requeued.result).toMatchObject({ status: 'PENDING', attempt_count: 0 });
    expect((await claim('2026-08-15T00:00:00.000Z')).some((row) => row['id'] === id)).toBe(true);
  });

  test('네 번째 worker가 lease를 잃으면 다음 claim이 영구 LEASED 대신 FAILED로 회수한다', async () => {
    const userId = await createUser(db, '아웃박스리스만료');
    const promiseId = await createPromise(db, { creatorId: userId });
    const id = await enqueue({ userId, promiseId, now: '2026-08-14T00:00:00.000Z' });
    await db.asAdmin(
      `update public.notification_outbox
          set status = 'LEASED',
              attempt_count = 4,
              lease_id = gen_random_uuid(),
              lease_expires_at = '2026-08-14T00:01:00Z'
        where id = $1`,
      [id],
    );

    expect(await claim('2026-08-14T00:02:00.000Z')).toEqual([]);
    const row = await one<{ status: string; last_error_code: string }>(
      `select status::text, last_error_code from public.notification_outbox where id = $1`,
      [id],
    );
    expect(row).toEqual({ status: 'FAILED', last_error_code: 'LEASE_EXPIRED' });
  });

  test.each([
    { attempt: 1, delaySeconds: 60, due: '2026-08-14T00:01:30.000Z' },
    { attempt: 2, delaySeconds: 300, due: '2026-08-14T00:05:30.000Z' },
    { attempt: 3, delaySeconds: 900, due: '2026-08-14T00:15:30.000Z' },
  ])(
    '$attempt회차 lease 만료는 $delaySeconds초 backoff 뒤에만 다음 attempt를 claim한다',
    async ({ attempt, due }) => {
      const userId = await createUser(db, `리스백오프${attempt}`);
      const promiseId = await createPromise(db, { creatorId: userId });
      const id = await enqueue({ userId, promiseId, now: '2026-08-14T00:00:00.000Z' });
      await db.asAdmin(
        `update public.notification_outbox
            set status = 'LEASED',
                attempt_count = $2,
                lease_id = gen_random_uuid(),
                lease_expires_at = '2026-08-14T00:00:30Z'
          where id = $1`,
        [id, attempt],
      );

      expect(await claim('2026-08-14T00:00:31.000Z')).toEqual([]);
      const waiting = await one<{
        status: string;
        next_attempt_at: string;
        last_error_code: string;
      }>(
        `select status::text, next_attempt_at::text, last_error_code
           from public.notification_outbox where id = $1`,
        [id],
      );
      expect(waiting).toMatchObject({
        status: 'PENDING',
        last_error_code: 'LEASE_EXPIRED',
      });
      expect(Date.parse(waiting.next_attempt_at)).toBe(Date.parse(due));
      expect(await claim(new Date(Date.parse(due) - 1).toISOString())).toEqual([]);
      expect(await claim(due)).toEqual([
        expect.objectContaining({ id, attempt_count: attempt + 1 }),
      ]);
    },
  );

  test('승인계열 전이 실패는 outbox intent도 함께 롤백한다', async () => {
    const creatorId = await createUser(db, '원자작성자');
    const partnerId = await createUser(db, '원자상대');
    const promiseId = await createPromise(db, { creatorId, status: 'PENDING' });
    const tokenHash = await createInvitation(db, { promiseId, createdBy: creatorId });
    await db.execAdmin(`
      create function public.lf_test_reject_outbox()
      returns trigger language plpgsql set search_path = '' as $$
      begin raise exception 'forced_outbox_failure'; end;
      $$;
      create trigger lf_test_reject_outbox
      before insert on public.notification_outbox
      for each row execute function public.lf_test_reject_outbox();
    `);

    try {
      await expect(
        db.asAdmin(
          `select public.lf_promise_decline(
             $1::uuid, $2::char(64), $3::uuid, null, 'WEB', null, null
           )`,
          [randomUUID(), tokenHash, partnerId],
        ),
      ).rejects.toThrow('forced_outbox_failure');
      const state = await one<{ status: string }>(
        `select status::text from public.promises where id = $1`,
        [promiseId],
      );
      expect(state.status).toBe('PENDING');
    } finally {
      await db.execAdmin(`
        drop trigger lf_test_reject_outbox on public.notification_outbox;
        drop function public.lf_test_reject_outbox();
      `);
    }
  });

  test('같은 Idempotency-Key 재호출은 전이 intent를 늘리지 않는다', async () => {
    const creatorId = await createUser(db, '멱등작성자');
    const partnerId = await createUser(db, '멱등상대');
    const promiseId = await createPromise(db, { creatorId, status: 'PENDING' });
    const tokenHash = await createInvitation(db, { promiseId, createdBy: creatorId });
    const key = randomUUID();
    const sql = `select public.lf_promise_decline(
      $1::uuid, $2::char(64), $3::uuid, null, 'WEB', null, null
    )`;

    await db.asAdmin(sql, [key, tokenHash, partnerId]);
    await db.asAdmin(sql, [key, tokenHash, partnerId]);

    const count = await one<{ count: number }>(
      `select count(*)::int as count from public.notification_outbox where promise_id = $1`,
      [promiseId],
    );
    expect(count.count).toBe(1);
  });

  test('J-01은 outbox intent가 커밋된 뒤에만 schedule을 SENT로 소비한다', async () => {
    const userId = await createUser(db, '리마인드보존');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 1,
    });
    const schedule = await one<{ id: string }>(
      `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
       values ($1, $2, 'D1', '2026-08-14T00:00:00Z') returning id`,
      [promiseId, userId],
    );
    await db.execAdmin(`
      create function public.lf_test_reject_j01_outbox()
      returns trigger language plpgsql set search_path = '' as $$
      begin raise exception 'forced_j01_failure'; end;
      $$;
      create trigger lf_test_reject_j01_outbox
      before insert on public.notification_outbox
      for each row execute function public.lf_test_reject_j01_outbox();
    `);

    try {
      await expect(
        db.asAdmin(`select public.lf_dispatch_due_reminders('2026-08-14T01:00:00Z', 10)`),
      ).rejects.toThrow('forced_j01_failure');
      const state = await one<{ status: string }>(
        `select status::text from public.reminder_schedules where id = $1`,
        [schedule.id],
      );
      expect(state.status).toBe('PENDING');
    } finally {
      await db.execAdmin(`
        drop trigger lf_test_reject_j01_outbox on public.notification_outbox;
        drop function public.lf_test_reject_j01_outbox();
      `);
    }
  });

  test('Data API 역할은 outbox와 RPC를 직접 사용할 수 없다', async () => {
    const userId = await createUser(db, '아웃박스권한');
    const promiseId = await createPromise(db, { creatorId: userId });
    await expect(
      db.asUser(userId, `select * from public.notification_outbox`),
    ).rejects.toThrow('permission denied');
    await expect(
      db.asUser(
        userId,
        `select public.lf_notification_outbox_claim(now(), 1, 30)`,
      ),
    ).rejects.toThrow('permission denied');
    expect(promiseId).toBeTruthy();
  });

  test('모든 Data API 역할은 outbox SELECT/INSERT/UPDATE/DELETE 권한이 없다', async () => {
    const roles = ['public', 'anon', 'authenticated', 'service_role'];
    const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

    for (const role of roles) {
      for (const privilege of privileges) {
        const result = await one<{ allowed: boolean }>(
          `select has_table_privilege($1, 'public.notification_outbox', $2) as allowed`,
          [role, privilege],
        );
        expect(result.allowed, `${role} must not have ${privilege}`).toBe(false);
      }
    }
  });
});
