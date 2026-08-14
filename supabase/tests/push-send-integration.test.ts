import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPushSendHandler } from '../functions/push-send/handler.ts';
import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('push-send real handler + PGlite', () => {
  test('outbox를 Expo ticket과 receipt까지 처리하고 PUSH notification을 SENT로 집계한다', async () => {
    const userId = await createUser(db, '통합푸시');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });
    await db.asAdmin(
      `insert into public.device_tokens (user_id, fcm_token, platform)
       values ($1, 'ExponentPushToken[integration]', 'ANDROID')`,
      [userId],
    );
    await db.asAdmin(
      `select public.lf_notification_outbox_enqueue(
        $1, $2, 'NT-01', $3::jsonb, 'integration', '2026-08-15T00:00:00Z'
      )`,
      [userId, promiseId, JSON.stringify({ partnerNickname: '민준', promiseTitle: '매일 걷기' })],
    );

    let now = new Date('2026-08-15T00:00:00.000Z');
    const httpBodies: unknown[] = [];
    const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
      const signatures: Record<string, { sql: string; params: unknown[] }> = {
        lf_push_claim_receipts: {
          sql: `select public.lf_push_claim_receipts($1::timestamptz, $2::int, $3::int) as result`,
          params: [args['p_now'], args['p_limit'], args['p_lease_seconds']],
        },
        lf_push_record_receipts: {
          sql: `select public.lf_push_record_receipts($1::jsonb, $2::timestamptz) as result`,
          params: [JSON.stringify(args['p_results']), args['p_now']],
        },
        lf_push_claim_deliveries: {
          sql: `select public.lf_push_claim_deliveries($1::timestamptz, $2::int, $3::int) as result`,
          params: [args['p_now'], args['p_limit'], args['p_lease_seconds']],
        },
        lf_push_record_tickets: {
          sql: `select public.lf_push_record_tickets($1::jsonb, $2::timestamptz) as result`,
          params: [JSON.stringify(args['p_results']), args['p_now']],
        },
        lf_push_refresh_notification_status: {
          sql: `select public.lf_push_refresh_notification_status($1::uuid[], $2::timestamptz) as result`,
          params: [args['p_notification_ids'], args['p_now']],
        },
        lf_notification_outbox_claim: {
          sql: `select public.lf_notification_outbox_claim($1::timestamptz, $2::int, $3::int) as result`,
          params: [args['p_now'], args['p_limit'], args['p_lease_seconds']],
        },
        lf_notification_outbox_record: {
          sql: `select public.lf_notification_outbox_record($1::uuid, $2::uuid, $3::boolean, $4::text, $5::text, $6::timestamptz) as result`,
          params: [args['p_outbox_id'], args['p_lease_id'], args['p_success'], args['p_body_snapshot'], args['p_error_code'], args['p_now']],
        },
        lf_notification_fanout: {
          sql: `select public.lf_notification_fanout($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::timestamptz) as result`,
          params: [args['p_user_id'], args['p_promise_id'], args['p_type'], args['p_title'], args['p_body'], args['p_deeplink'], args['p_inapp_dedupe_key'], args['p_push_dedupe_key'], args['p_now']],
        },
        lf_dispatch_due_reminders: {
          sql: `select public.lf_dispatch_due_reminders($1::timestamptz, $2::int) as result`,
          params: [args['p_now'], args['p_limit']],
        },
      };
      const call = signatures[fn];
      if (call === undefined) throw new Error(`unexpected RPC ${fn}`);
      const result = await db.asAdmin(call.sql, call.params);
      return result.rows[0]?.['result'];
    };
    const handler = createPushSendHandler({
      secret: 'integration-secret',
      rpc,
      fetch: async (url, init) => {
        httpBodies.push(JSON.parse(String(init?.body)));
        if (String(url).includes('getReceipts')) {
          return new Response(JSON.stringify({ data: { 'integration-ticket': { status: 'ok' } } }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'integration-ticket' }] }), { status: 200 });
      },
      now: () => now,
      elapsedMs: () => 0,
      log: { error: () => {} },
    });
    const invoke = () => handler(new Request('https://example.test/functions/v1/push-send', {
      method: 'POST', headers: { 'x-push-send-secret': 'integration-secret' },
    }));

    expect((await invoke()).status).toBe(200);
    const ticketed = await db.asAdmin(
      `select d.status::text, d.attempt_count, d.expo_ticket_id, n.status::text as notification_status
         from public.push_deliveries d join public.notifications n on n.id = d.notification_id
        where n.channel = 'PUSH' and n.promise_id = $1`,
      [promiseId],
    );
    expect(ticketed.rows[0]).toMatchObject({
      status: 'RECEIPT_PENDING', attempt_count: 1,
      expo_ticket_id: 'integration-ticket', notification_status: 'QUEUED',
    });

    now = new Date('2026-08-15T00:15:00.000Z');
    expect((await invoke()).status).toBe(200);
    const delivered = await db.asAdmin(
      `select d.status::text, d.receipt_checked_at::text, n.status::text as notification_status,
              n.sent_at::text
         from public.push_deliveries d join public.notifications n on n.id = d.notification_id
        where n.channel = 'PUSH' and n.promise_id = $1`,
      [promiseId],
    );
    expect(delivered.rows[0]).toEqual({
      status: 'DELIVERED', receipt_checked_at: '2026-08-15 00:15:00+00',
      notification_status: 'SENT', sent_at: '2026-08-15 00:15:00+00',
    });
    expect(httpBodies).toHaveLength(2);
  });

  test('ticket 뒤 receipt MessageRateExceeded는 FAILED로 종결되고 send나 receipt를 다시 호출하지 않는다', async () => {
    const userId = await createUser(db, '통합푸시종결');
    const promiseId = await createPromise(db, { creatorId: userId, status: 'ACTIVE' });
    await db.asAdmin(
      `insert into public.device_tokens (user_id, fcm_token, platform)
       values ($1, 'ExponentPushToken[terminal-receipt]', 'ANDROID')`,
      [userId],
    );
    await db.asAdmin(
      `select public.lf_notification_fanout(
         $1, $2, 'NT-01', '약속 성립', '매일 걷기', 'SCR-A05',
         'terminal-inapp', 'terminal-push', '2026-08-15T00:00:00Z'
       )`,
      [userId, promiseId],
    );

    let now = new Date('2026-08-15T00:00:00.000Z');
    let sendRequests = 0;
    let receiptRequests = 0;
    const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
      const signatures: Record<string, { sql: string; params: unknown[] }> = {
        lf_push_claim_receipts: {
          sql: `select public.lf_push_claim_receipts($1::timestamptz, $2::int, $3::int) as result`,
          params: [args['p_now'], args['p_limit'], args['p_lease_seconds']],
        },
        lf_push_record_receipts: {
          sql: `select public.lf_push_record_receipts($1::jsonb, $2::timestamptz) as result`,
          params: [JSON.stringify(args['p_results']), args['p_now']],
        },
        lf_push_claim_deliveries: {
          sql: `select public.lf_push_claim_deliveries($1::timestamptz, $2::int, $3::int) as result`,
          params: [args['p_now'], args['p_limit'], args['p_lease_seconds']],
        },
        lf_push_record_tickets: {
          sql: `select public.lf_push_record_tickets($1::jsonb, $2::timestamptz) as result`,
          params: [JSON.stringify(args['p_results']), args['p_now']],
        },
        lf_notification_outbox_claim: {
          sql: `select public.lf_notification_outbox_claim($1::timestamptz, $2::int, $3::int) as result`,
          params: [args['p_now'], args['p_limit'], args['p_lease_seconds']],
        },
        lf_dispatch_due_reminders: {
          sql: `select public.lf_dispatch_due_reminders($1::timestamptz, $2::int) as result`,
          params: [args['p_now'], args['p_limit']],
        },
      };
      const call = signatures[fn];
      if (call === undefined) throw new Error(`unexpected RPC ${fn}`);
      const result = await db.asAdmin(call.sql, call.params);
      return result.rows[0]?.['result'];
    };
    const handler = createPushSendHandler({
      secret: 'integration-secret',
      rpc,
      fetch: async (url) => {
        if (String(url).includes('getReceipts')) {
          receiptRequests += 1;
          return new Response(JSON.stringify({ data: {
            'terminal-ticket': { status: 'error', details: { error: 'MessageRateExceeded' } },
          } }), { status: 200 });
        }
        sendRequests += 1;
        return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'terminal-ticket' }] }), {
          status: 200,
        });
      },
      now: () => now,
      elapsedMs: () => 0,
      log: { error: () => undefined },
    });
    const invoke = () => handler(new Request('https://example.test/functions/v1/push-send', {
      method: 'POST', headers: { 'x-push-send-secret': 'integration-secret' },
    }));

    expect((await invoke()).status).toBe(200);
    now = new Date('2026-08-15T00:15:00.000Z');
    expect((await invoke()).status).toBe(200);
    now = new Date('2026-08-15T00:30:00.000Z');
    expect((await invoke()).status).toBe(200);

    const state = await db.asAdmin(
      `select d.status::text, d.attempt_count, d.expo_ticket_id, d.last_error_code,
              n.status::text as notification_status
         from public.push_deliveries d
         join public.notifications n on n.id = d.notification_id
        where n.dedupe_key = 'terminal-push'`,
    );
    expect(state.rows).toEqual([{
      status: 'FAILED',
      attempt_count: 1,
      expo_ticket_id: 'terminal-ticket',
      last_error_code: 'MessageRateExceeded',
      notification_status: 'FAILED',
    }]);
    expect({ receiptRequests, sendRequests }).toEqual({ receiptRequests: 1, sendRequests: 1 });
  });
});
