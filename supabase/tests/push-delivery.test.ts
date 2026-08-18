import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

const NOW = '2026-08-15T00:00:00Z';

async function makeDelivery(suffix: string): Promise<{
  deliveryId: string;
  notificationId: string;
  promiseId: string;
  tokenId: string;
  token: string;
  userId: string;
}> {
  const userId = await createUser(db, `push-${suffix}`);
  const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });
  const token = `ExponentPushToken[${suffix}]`;
  const tokenRow = await db.asAdmin(
    `insert into public.device_tokens (user_id, fcm_token, platform)
     values ($1, $2, 'ANDROID') returning id`,
    [userId, token],
  );
  const tokenId = String(tokenRow.rows[0]?.['id']);
  const fanout = await db.asAdmin(
    `select public.lf_notification_fanout(
       $1, $2, 'NT-01', '약속 성립', '매일 걷기', 'SCR-A05', $3, $4, $5
     ) as result`,
    [userId, promiseId, `inapp-${suffix}`, `push-${suffix}`, NOW],
  );
  const notificationId = String(
    (fanout.rows[0]?.['result'] as { push_notification_id: string }).push_notification_id,
  );
  const delivery = await db.asAdmin(
    `select id from public.push_deliveries where notification_id = $1`,
    [notificationId],
  );
  return {
    deliveryId: String(delivery.rows[0]?.['id']),
    notificationId,
    promiseId,
    tokenId,
    token,
    userId,
  };
}

async function claimDeliveries(now = NOW, limit = 500): Promise<Record<string, unknown>[]> {
  const { rows } = await db.asAdmin(
    `select public.lf_push_claim_deliveries($1::timestamptz, $2::int, 60) as result`,
    [now, limit],
  );
  return rows[0]?.['result'] as Record<string, unknown>[];
}

async function recordTickets(results: Record<string, unknown>[], now = NOW): Promise<unknown> {
  const { rows } = await db.asAdmin(
    `select public.lf_push_record_tickets($1::jsonb, $2::timestamptz) as result`,
    [JSON.stringify(results), now],
  );
  return rows[0]?.['result'];
}

beforeEach(async () => {
  db = await createTestDb();
}, 60_000);

afterEach(async () => {
  await db.close();
});

describe('fenced Expo push delivery RPC', () => {
  test('claim마다 lease를 회전시키고 실제 Expo 결과 기록 전에는 attempt를 늘리지 않는다', async () => {
    const item = await makeDelivery('lease-rotation');
    const first = (await claimDeliveries())[0];

    expect(first).toMatchObject({
      id: item.deliveryId,
      notification_id: item.notificationId,
      promise_id: item.promiseId,
      attempt_count: 0,
      expo_push_token: item.token,
    });
    expect(first?.['lease_id']).toEqual(expect.any(String));

    await db.asAdmin(
      `update public.push_deliveries set lease_expires_at = $2 where id = $1`,
      [item.deliveryId, '2026-08-15T00:00:59Z'],
    );
    const second = (await claimDeliveries('2026-08-15T00:01:00Z'))[0];

    expect(second?.['lease_id']).not.toBe(first?.['lease_id']);
    expect(second?.['attempt_count']).toBe(0);
  });

  test('stale ticket 결과를 무시하면서 같은 배열의 현재 lease 결과는 원자적으로 기록한다', async () => {
    const staleItem = await makeDelivery('stale-ticket');
    const currentItem = await makeDelivery('current-ticket');
    const claimed = await claimDeliveries();
    const stale = claimed.find((row) => row['id'] === staleItem.deliveryId)!;
    const current = claimed.find((row) => row['id'] === currentItem.deliveryId)!;

    await db.asAdmin(`update public.push_deliveries set lease_id = gen_random_uuid() where id = $1`, [
      staleItem.deliveryId,
    ]);
    const result = await recordTickets([
      {
        delivery_id: staleItem.deliveryId,
        lease_id: stale['lease_id'],
        outcome: 'ticket',
        expo_ticket_id: 'stale-ticket-id',
        attempted: true,
      },
      {
        delivery_id: currentItem.deliveryId,
        lease_id: current['lease_id'],
        outcome: 'ticket',
        expo_ticket_id: 'current-ticket-id',
        attempted: true,
      },
    ]);

    expect(result).toMatchObject({
      accepted: 1,
      ignored: 1,
      ticketed: 1,
      aggregation: { sent: 0, failed: 0, pending: 1 },
    });
    const rows = await db.asAdmin(
      `select id, status::text, attempt_count, expo_ticket_id
         from public.push_deliveries where id = any($1::uuid[]) order by id`,
      [[staleItem.deliveryId, currentItem.deliveryId]],
    );
    expect(rows.rows.find((row) => row['id'] === staleItem.deliveryId)).toMatchObject({
      status: 'LEASED',
      attempt_count: 0,
      expo_ticket_id: null,
    });
    expect(rows.rows.find((row) => row['id'] === currentItem.deliveryId)).toMatchObject({
      status: 'RECEIPT_PENDING',
      attempt_count: 1,
      expo_ticket_id: 'current-ticket-id',
    });
  });

  test('ticket 결과와 notification 집계 중 하나라도 실패하면 delivery 변경도 롤백한다', async () => {
    const item = await makeDelivery('ticket-aggregate-rollback');
    const claimed = (await claimDeliveries())[0]!;
    await db.execAdmin(`
      create or replace function public.lf_push_refresh_notification_status(
        p_notification_ids uuid[], p_now timestamptz default now()
      )
      returns jsonb language plpgsql security definer set search_path = '' as $$
      begin
        raise exception 'TEST_AGGREGATE_FAILURE';
      end;
      $$;
    `);

    await expect(recordTickets([{
      delivery_id: item.deliveryId,
      lease_id: claimed['lease_id'],
      outcome: 'ticket',
      expo_ticket_id: 'must-roll-back-ticket',
      attempted: true,
    }])).rejects.toThrow(/TEST_AGGREGATE_FAILURE/u);
    const state = await db.asAdmin(
      `select status::text, attempt_count, expo_ticket_id from public.push_deliveries where id = $1`,
      [item.deliveryId],
    );
    expect(state.rows[0]).toEqual({ status: 'LEASED', attempt_count: 0, expo_ticket_id: null });
  });

  test('no-ticket send 실패는 60/300/900초 뒤 재시도하고 네 번째 시도에서 끝난다', async () => {
    const item = await makeDelivery('send-retry');
    const times = [
      '2026-08-15T00:00:00Z',
      '2026-08-15T00:01:00Z',
      '2026-08-15T00:06:00Z',
      '2026-08-15T00:21:00Z',
    ];
    const expectedNext = [
      '2026-08-15 00:01:00+00',
      '2026-08-15 00:06:00+00',
      '2026-08-15 00:21:00+00',
      '2026-08-15 00:21:00+00',
    ];

    for (let index = 0; index < times.length; index += 1) {
      const now = times[index]!;
      const claimed = (await claimDeliveries(now))[0]!;
      await recordTickets(
        [{
          delivery_id: item.deliveryId,
          lease_id: claimed['lease_id'],
          outcome: 'retry',
          error_code: 'HTTP_429',
          attempted: true,
        }],
        now,
      );
      const row = await db.asAdmin(
        `select status::text, attempt_count, next_attempt_at::text
           from public.push_deliveries where id = $1`,
        [item.deliveryId],
      );
      expect(row.rows[0]).toEqual({
        status: index === 3 ? 'FAILED' : 'RETRY',
        attempt_count: index + 1,
        next_attempt_at: expectedNext[index],
      });
    }
  });

  test('ticket 발급 뒤에는 다시 send claim하지 않고 15분 뒤 receipt를 한 번 claim한다', async () => {
    const item = await makeDelivery('receipt-window');
    const claimed = (await claimDeliveries())[0]!;
    await recordTickets([{
      delivery_id: item.deliveryId,
      lease_id: claimed['lease_id'],
      outcome: 'ticket',
      expo_ticket_id: 'receipt-window-ticket',
      attempted: true,
    }]);

    expect(await claimDeliveries('2026-08-15T00:20:00Z')).toEqual([]);
    const early = await db.asAdmin(
      `select public.lf_push_claim_receipts('2026-08-15T00:14:59Z', 1000, 60) as result`,
    );
    expect(early.rows[0]?.['result']).toEqual([]);
    const eligible = await db.asAdmin(
      `select public.lf_push_claim_receipts('2026-08-15T00:15:00Z', 1000, 60) as result`,
    );
    expect(eligible.rows[0]?.['result']).toMatchObject([
      { id: item.deliveryId, expo_ticket_id: 'receipt-window-ticket' },
    ]);
  });

  test('stale receipt 결과도 무시하고 같은 배열의 현재 lease receipt는 계속 기록한다', async () => {
    const staleItem = await makeDelivery('stale-receipt');
    const currentItem = await makeDelivery('current-receipt');
    const sendClaims = await claimDeliveries();
    await recordTickets(sendClaims.map((row) => ({
      delivery_id: row['id'],
      lease_id: row['lease_id'],
      outcome: 'ticket',
      expo_ticket_id: row['id'] === staleItem.deliveryId ? 'stale-receipt-ticket' : 'current-receipt-ticket',
      attempted: true,
    })));
    const receiptRows = await db.asAdmin(
      `select public.lf_push_claim_receipts('2026-08-15T00:15:00Z', 1000, 60) as result`,
    );
    const receiptClaims = receiptRows.rows[0]?.['result'] as Record<string, unknown>[];
    const stale = receiptClaims.find((row) => row['id'] === staleItem.deliveryId)!;
    const current = receiptClaims.find((row) => row['id'] === currentItem.deliveryId)!;
    await db.asAdmin(`update public.push_deliveries set lease_id = gen_random_uuid() where id = $1`, [staleItem.deliveryId]);

    const recorded = await db.asAdmin(
      `select public.lf_push_record_receipts($1::jsonb, '2026-08-15T00:15:01Z') as result`,
      [JSON.stringify([
        { delivery_id: staleItem.deliveryId, lease_id: stale['lease_id'], expo_ticket_id: stale['expo_ticket_id'], outcome: 'delivered' },
        { delivery_id: currentItem.deliveryId, lease_id: current['lease_id'], expo_ticket_id: current['expo_ticket_id'], outcome: 'delivered' },
      ])],
    );
    expect(recorded.rows[0]?.['result']).toMatchObject({
      accepted: 1,
      ignored: 1,
      delivered: 1,
      aggregation: { sent: 1, failed: 0, pending: 0 },
    });
    const state = await db.asAdmin(
      `select id, status::text from public.push_deliveries where id = any($1::uuid[])`,
      [[staleItem.deliveryId, currentItem.deliveryId]],
    );
    expect(state.rows.find((row) => row['id'] === staleItem.deliveryId)?.['status']).toBe('LEASED');
    expect(state.rows.find((row) => row['id'] === currentItem.deliveryId)?.['status']).toBe('DELIVERED');
  });

  test('receipt 결과와 notification 집계 실패도 같은 트랜잭션에서 롤백한다', async () => {
    const item = await makeDelivery('receipt-aggregate-rollback');
    const claimed = (await claimDeliveries())[0]!;
    await recordTickets([{
      delivery_id: item.deliveryId,
      lease_id: claimed['lease_id'],
      outcome: 'ticket',
      expo_ticket_id: 'receipt-rollback-ticket',
      attempted: true,
    }]);
    const receipt = await db.asAdmin(
      `select public.lf_push_claim_receipts('2026-08-15T00:15:00Z', 1000, 60) as result`,
    );
    const receiptClaim = (receipt.rows[0]?.['result'] as Record<string, unknown>[])[0]!;
    await db.execAdmin(`
      create or replace function public.lf_push_refresh_notification_status(
        p_notification_ids uuid[], p_now timestamptz default now()
      )
      returns jsonb language plpgsql security definer set search_path = '' as $$
      begin
        raise exception 'TEST_AGGREGATE_FAILURE';
      end;
      $$;
    `);

    await expect(db.asAdmin(
      `select public.lf_push_record_receipts($1::jsonb, '2026-08-15T00:15:01Z')`,
      [JSON.stringify([{
        delivery_id: item.deliveryId,
        lease_id: receiptClaim['lease_id'],
        expo_ticket_id: receiptClaim['expo_ticket_id'],
        outcome: 'delivered',
      }])],
    )).rejects.toThrow(/TEST_AGGREGATE_FAILURE/u);
    const state = await db.asAdmin(
      `select status::text, receipt_checked_at from public.push_deliveries where id = $1`,
      [item.deliveryId],
    );
    expect(state.rows[0]).toEqual({ status: 'LEASED', receipt_checked_at: null });
  });

  test('EC-G02 DeviceNotRegistered는 claim 당시 같은 사용자의 같은 토큰만 삭제한다', async () => {
    const item = await makeDelivery('token-reassigned');
    const claimed = (await claimDeliveries())[0]!;
    const newOwner = await createUser(db, 'new-token-owner');
    await db.asAdmin(`update public.device_tokens set user_id = $2 where id = $1`, [item.tokenId, newOwner]);

    await recordTickets([{
      delivery_id: item.deliveryId,
      lease_id: claimed['lease_id'],
      outcome: 'failed',
      error_code: 'DeviceNotRegistered',
      attempted: true,
      device_token_id: item.tokenId,
      expo_push_token: item.token,
    }]);

    const token = await db.asAdmin(`select user_id from public.device_tokens where id = $1`, [item.tokenId]);
    expect(token.rows).toEqual([{ user_id: newOwner }]);
  });

  test('receipt DeviceNotRegistered는 같은 행·사용자의 변경된 새 token 값을 삭제하지 않는다', async () => {
    const item = await makeDelivery('receipt-token-snapshot');
    const claimed = (await claimDeliveries())[0]!;
    await recordTickets([{
      delivery_id: item.deliveryId,
      lease_id: claimed['lease_id'],
      outcome: 'ticket',
      expo_ticket_id: 'receipt-token-snapshot-ticket',
      attempted: true,
    }]);
    await db.asAdmin(
      `update public.device_tokens set fcm_token = 'ExponentPushToken[new-valid-value]' where id = $1`,
      [item.tokenId],
    );
    const receipt = await db.asAdmin(
      `select public.lf_push_claim_receipts('2026-08-15T00:15:00Z', 1000, 60) as result`,
    );
    const receiptClaim = (receipt.rows[0]?.['result'] as Record<string, unknown>[])[0]!;
    await db.asAdmin(
      `select public.lf_push_record_receipts($1::jsonb, '2026-08-15T00:15:01Z')`,
      [JSON.stringify([{
        delivery_id: item.deliveryId,
        lease_id: receiptClaim['lease_id'],
        expo_ticket_id: receiptClaim['expo_ticket_id'],
        outcome: 'failed',
        error_code: 'DeviceNotRegistered',
      }])],
    );
    const token = await db.asAdmin(
      `select fcm_token from public.device_tokens where id = $1`,
      [item.tokenId],
    );
    expect(token.rows).toEqual([{ fcm_token: 'ExponentPushToken[new-valid-value]' }]);
  });

  test('receipt와 notification 집계는 일부 성공을 SENT, 전부 영구 실패를 FAILED로 만든다', async () => {
    const success = await makeDelivery('aggregate-success');
    const failed = await makeDelivery('aggregate-failed');
    await db.asAdmin(
      `update public.push_deliveries
          set status = case when id = $1 then 'DELIVERED'::public.push_delivery_status
                            else 'FAILED'::public.push_delivery_status end,
              last_error_code = case when id = $2 then 'InvalidCredentials' else null end
        where id = any($3::uuid[])`,
      [success.deliveryId, failed.deliveryId, [success.deliveryId, failed.deliveryId]],
    );
    await db.asAdmin(
      `update public.push_deliveries set notification_id = $1 where id = $2`,
      [success.notificationId, failed.deliveryId],
    );

    const result = await db.asAdmin(
      `select public.lf_push_refresh_notification_status(array[$1]::uuid[], $2) as result`,
      [success.notificationId, NOW],
    );
    expect(result.rows[0]?.['result']).toEqual({ sent: 1, failed: 0, pending: 0 });
    const notification = await db.asAdmin(
      `select status::text, sent_at::text, fail_reason from public.notifications where id = $1`,
      [success.notificationId],
    );
    expect(notification.rows[0]).toEqual({ status: 'SENT', sent_at: '2026-08-15 00:00:00+00', fail_reason: null });
  });

  test('전부 영구 실패한 notification만 FAILED로 만들고 비종결 delivery가 있으면 QUEUED를 유지한다', async () => {
    const terminal = await makeDelivery('aggregate-terminal');
    const pending = await makeDelivery('aggregate-pending');
    await db.asAdmin(
      `update public.push_deliveries set status = 'FAILED', last_error_code = 'MessageTooBig' where id = $1`,
      [terminal.deliveryId],
    );
    const result = await db.asAdmin(
      `select public.lf_push_refresh_notification_status(array[$1, $2]::uuid[], $3) as result`,
      [terminal.notificationId, pending.notificationId, NOW],
    );
    expect(result.rows[0]?.['result']).toEqual({ sent: 0, failed: 1, pending: 1 });
    const statuses = await db.asAdmin(
      `select id, status::text from public.notifications where id = any($1::uuid[])`,
      [[terminal.notificationId, pending.notificationId]],
    );
    expect(statuses.rows.find((row) => row['id'] === terminal.notificationId)?.['status']).toBe('FAILED');
    expect(statuses.rows.find((row) => row['id'] === pending.notificationId)?.['status']).toBe('QUEUED');
  });

  test('PUSH notification은 허용된 화면과 promise_id가 없으면 새 delivery를 만들 수 없다', async () => {
    const item = await makeDelivery('payload-constraint');

    await expect(db.asAdmin(
      `update public.notifications set deeplink = 'https://evil.example' where id = $1`,
      [item.notificationId],
    )).rejects.toThrow(/notifications_push_payload_shape/iu);
    await expect(db.asAdmin(
      `update public.notifications set promise_id = null where id = $1`,
      [item.notificationId],
    )).rejects.toThrow(/notifications_push_payload_shape/iu);
  });

  test('notification 집계 함수는 UUID 오름차순으로 행 잠금을 획득한다', async () => {
    const definition = await db.asAdmin(
      `select pg_get_functiondef(
         'public.lf_push_refresh_notification_status(uuid[],timestamptz)'::regprocedure
       ) as definition`,
    );

    expect(String(definition.rows[0]?.['definition'])).toMatch(
      /select distinct id[\s\S]*from unnest[\s\S]*order by id/iu,
    );
  });

  test('내부 RPC와 delivery 테이블은 Data API 역할에서 실행할 수 없다', async () => {
    const userId = await createUser(db, 'push-permission');
    await expect(db.asUser(userId, `select public.lf_push_claim_deliveries(now(), 1, 60)`)).rejects.toThrow(/permission denied/iu);
    const { rows } = await db.asAdmin(
      `select has_function_privilege('authenticated', 'public.lf_push_claim_deliveries(timestamptz,integer,integer)', 'EXECUTE') as rpc,
              has_table_privilege('service_role', 'public.push_deliveries', 'SELECT') as direct_table`,
    );
    expect(rows[0]).toEqual({ rpc: false, direct_table: false });
  });
});
