import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

interface FanoutResult {
  inapp_notification_id: string;
  push_notification_id: string | null;
  delivery_count: number;
}

interface NotificationRow {
  id: string;
  channel: 'INAPP' | 'PUSH';
  status: 'SENT' | 'QUEUED';
  dedupe_key: string;
  sent_at: string | null;
}

async function register(userId: string, suffix: string): Promise<void> {
  await db.asAdmin(`select public.lf_device_token_register($1, $2)`, [
    userId,
    `ExponentPushToken[${suffix}]`,
  ]);
}

async function fanout(input: {
  userId: string;
  promiseId: string;
  suffix: string;
}): Promise<FanoutResult> {
  const { rows } = await db.asAdmin(
    `select public.lf_notification_fanout(
       $1, $2, 'NT-01', '약속 성립', '매일 걷기', 'SCR-A05', $3, $4,
       '2026-08-01T03:00:00Z'
     ) as result`,
    [
      input.userId,
      input.promiseId,
      `${input.promiseId}:NT-01:${input.userId}:INAPP:${input.suffix}`,
      `${input.promiseId}:NT-01:${input.userId}:PUSH:${input.suffix}`,
    ],
  );
  return (rows[0] as { result: FanoutResult }).result;
}

async function notificationRows(promiseId: string): Promise<NotificationRow[]> {
  const { rows } = await db.asAdmin(
    `select id, channel::text, status::text, dedupe_key, sent_at::text
       from public.notifications
      where promise_id = $1
      order by channel`,
    [promiseId],
  );
  return rows as unknown as NotificationRow[];
}

async function deliveryRows(notificationId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await db.asAdmin(
    `select notification_id, device_token_id, status::text, attempt_count,
            next_attempt_at::text, lease_expires_at, expo_ticket_id
       from public.push_deliveries
      where notification_id = $1
      order by device_token_id`,
    [notificationId],
  );
  return rows;
}

async function messageOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('lf_notification_fanout — 논리 알림의 채널·기기 fanout', () => {
  test('ACTIVE 수신자와 토큰 스냅샷을 변경과 재할당에서 잠근다', async () => {
    // PGlite는 단일 user/connection이라 실제 두 트랜잭션의 lock wait를 실행할 수 없다.
    // 운영 Postgres에서 필요한 두 FOR SHARE 경계가 함수에 남아 있는지를 카탈로그로 지킨다.
    const { rows } = await db.asAdmin(
      `select pg_get_functiondef(
         'public.lf_notification_fanout(uuid,uuid,text,text,text,text,text,text,timestamptz)'
           ::regprocedure
       ) as definition`,
    );
    const definition = String(rows[0]?.['definition']).replace(/\s+/gu, ' ').toLowerCase();

    expect(definition).toMatch(
      /perform 1 from public\.users u where u\.id = p_user_id and u\.status = 'active' for share;/u,
    );
    expect(definition).toMatch(
      /select dt\.id from public\.device_tokens dt where dt\.user_id = p_user_id order by dt\.id for share/u,
    );
  });

  test('delivery 상태와 저장 열이 push worker 계약과 정확히 같다', async () => {
    const statuses = await db.asAdmin(
      `select e.enumlabel
         from pg_type t
         join pg_enum e on e.enumtypid = t.oid
        where t.typname = 'push_delivery_status'
        order by e.enumsortorder`,
    );
    expect(statuses.rows.map((row) => row['enumlabel'])).toEqual([
      'QUEUED',
      'LEASED',
      'RECEIPT_PENDING',
      'RETRY',
      'DELIVERED',
      'FAILED',
    ]);

    const columns = await db.asAdmin(
      `select column_name
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'push_deliveries'
        order by ordinal_position`,
    );
    expect(columns.rows.map((row) => row['column_name'])).toEqual([
      'id',
      'notification_id',
      'device_token_id',
      'status',
      'attempt_count',
      'next_attempt_at',
      'lease_expires_at',
      'expo_ticket_id',
      'ticketed_at',
      'receipt_checked_at',
      'last_error_code',
      'created_at',
      'updated_at',
      'lease_id',
    ]);
  });

  test('토큰이 없으면 SENT INAPP만 만들고 PUSH를 만들지 않는다', async () => {
    const userId = await createUser(db, '토큰없음');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });

    const result = await fanout({ userId, promiseId, suffix: 'zero' });

    expect(result).toMatchObject({ push_notification_id: null, delivery_count: 0 });
    expect(await notificationRows(promiseId)).toMatchObject([
      {
        id: result.inapp_notification_id,
        channel: 'INAPP',
        status: 'SENT',
        dedupe_key: `${promiseId}:NT-01:${userId}:INAPP:zero`,
        sent_at: '2026-08-01 03:00:00+00',
      },
    ]);
  });

  test('토큰 하나면 PUSH 한 행과 QUEUED delivery 한 행을 만든다', async () => {
    const userId = await createUser(db, '한기기');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });
    await register(userId, 'one');

    const result = await fanout({ userId, promiseId, suffix: 'one' });

    expect(result.delivery_count).toBe(1);
    expect(result.push_notification_id).not.toBeNull();
    expect(await notificationRows(promiseId)).toMatchObject([
      { channel: 'INAPP', status: 'SENT' },
      {
        id: result.push_notification_id,
        channel: 'PUSH',
        status: 'QUEUED',
        dedupe_key: `${promiseId}:NT-01:${userId}:PUSH:one`,
        sent_at: null,
      },
    ]);
    expect(await deliveryRows(result.push_notification_id ?? '')).toMatchObject([
      {
        notification_id: result.push_notification_id,
        status: 'QUEUED',
        attempt_count: 0,
        next_attempt_at: '2026-08-01 03:00:00+00',
        lease_expires_at: null,
        expo_ticket_id: null,
      },
    ]);
  });

  test('토큰 세 개면 PUSH는 한 행이고 delivery는 기기별 세 행이다', async () => {
    const userId = await createUser(db, '세기기');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });
    await register(userId, 'three-a');
    await register(userId, 'three-b');
    await register(userId, 'three-c');

    const result = await fanout({ userId, promiseId, suffix: 'three' });

    expect(result.delivery_count).toBe(3);
    expect((await notificationRows(promiseId)).filter((row) => row.channel === 'PUSH')).toHaveLength(
      1,
    );
    expect(await deliveryRows(result.push_notification_id ?? '')).toHaveLength(3);
  });

  test('같은 dedupe 재시도는 행을 늘리거나 뒤늦게 등록한 토큰을 포함하지 않는다', async () => {
    const userId = await createUser(db, '멱등');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });

    const first = await fanout({ userId, promiseId, suffix: 'retry' });
    await register(userId, 'registered-after-first-fanout');
    const second = await fanout({ userId, promiseId, suffix: 'retry' });

    expect(second).toEqual(first);
    expect(await notificationRows(promiseId)).toHaveLength(1);
    expect(first.push_notification_id).toBeNull();
  });

  test('fanout 도중 등록된 토큰은 처음 캡처한 delivery 스냅샷에 들어오지 않는다', async () => {
    const userId = await createUser(db, '스냅샷');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });
    await db.execAdmin(`
      create function public.lf_test_register_token_after_inapp()
      returns trigger
      language plpgsql
      set search_path = ''
      as $$
      begin
        if new.channel = 'INAPP' and new.dedupe_key like '%:snapshot' then
          insert into public.device_tokens (user_id, fcm_token, platform)
          values (new.user_id, 'ExponentPushToken[registered-during-fanout]', 'ANDROID');
        end if;
        return new;
      end;
      $$;

      create trigger lf_test_register_token_after_inapp
      after insert on public.notifications
      for each row execute function public.lf_test_register_token_after_inapp();
    `);

    try {
      const result = await fanout({ userId, promiseId, suffix: 'snapshot' });

      expect(result).toMatchObject({ push_notification_id: null, delivery_count: 0 });
      expect(await notificationRows(promiseId)).toHaveLength(1);
      const registered = await db.asAdmin(
        `select id from public.device_tokens where user_id = $1`,
        [userId],
      );
      expect(registered.rows).toHaveLength(1);
    } finally {
      await db.execAdmin(`
        drop trigger lf_test_register_token_after_inapp on public.notifications;
        drop function public.lf_test_register_token_after_inapp();
      `);
    }
  });

  test('ACTIVE가 아닌 수신자에게는 알림을 만들지 않는다', async () => {
    const userId = await createUser(db, '비활성');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });
    await db.asAdmin(`update public.users set status = 'SUSPENDED' where id = $1`, [userId]);

    const message = await messageOf(() => fanout({ userId, promiseId, suffix: 'inactive' }));

    expect(message).toContain('E_FORBIDDEN');
    expect(await notificationRows(promiseId)).toEqual([]);
  });

  test('클라이언트는 push_deliveries와 내부 RPC에 직접 접근할 수 없다', async () => {
    const userId = await createUser(db, '권한');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });

    await expect(db.asUser(userId, 'select id from public.push_deliveries')).rejects.toThrow(
      /permission denied/iu,
    );
    await expect(
      db.asUser(
        userId,
        `select public.lf_notification_fanout(
           $1, $2, 'NT-01', '위조', '위조', 'SCR-A05', 'forged-inapp', 'forged-push'
         )`,
        [userId, promiseId],
      ),
    ).rejects.toThrow(/permission denied/iu);

    const { rows } = await db.asAdmin(
      `select has_table_privilege('anon', 'public.push_deliveries', 'SELECT') as anon_table,
              has_table_privilege(
                'authenticated', 'public.push_deliveries', 'SELECT'
              ) as authenticated_table,
              has_function_privilege(
                'anon',
                'public.lf_notification_fanout(uuid,uuid,text,text,text,text,text,text,timestamptz)',
                'EXECUTE'
              ) as anon_rpc,
              has_function_privilege(
                'authenticated',
                'public.lf_notification_fanout(uuid,uuid,text,text,text,text,text,text,timestamptz)',
                'EXECUTE'
              ) as authenticated_rpc`,
    );
    expect(rows[0]).toEqual({
      anon_table: false,
      authenticated_table: false,
      anon_rpc: false,
      authenticated_rpc: false,
    });
  });
});
