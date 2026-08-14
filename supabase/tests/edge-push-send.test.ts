import { describe, expect, test, vi } from 'vitest';

import { createPushSendHandler, type PushSendDeps } from '../functions/push-send/handler.ts';

const SECRET = 'push-worker-secret-value';
const NOW = new Date('2026-08-15T00:00:00.000Z');

function delivery(index: number): Record<string, unknown> {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    notification_id: '11111111-1111-4111-8111-111111111111',
    promise_id: '44444444-4444-4444-8444-444444444444',
    device_token_id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
    expo_push_token: `ExponentPushToken[sensitive-${index}]`,
    title: `민감 제목 ${index}`,
    body: `민감 본문 ${index}`,
    deeplink: 'SCR-A05',
    attempt_count: 0,
    lease_id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
  };
}

function baseDeps(overrides: Partial<PushSendDeps> = {}): PushSendDeps {
  return {
    secret: SECRET,
    rpc: async (fn) => {
      if (fn === 'lf_push_claim_receipts' || fn === 'lf_push_claim_deliveries') return [];
      if (fn === 'lf_notification_outbox_claim') return [];
      if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
      return {};
    },
    fetch: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
    now: () => NOW,
    elapsedMs: () => 0,
    log: { error: () => {} },
    ...overrides,
  };
}

function request(secret = SECRET): Request {
  return new Request('https://example.test/functions/v1/push-send', {
    method: 'POST',
    headers: { 'x-push-send-secret': secret },
  });
}

describe('push-send handler', () => {
  test('누락·길이가 다른 값·같은 길이의 오답 secret을 모두 거부한다', async () => {
    const handler = createPushSendHandler(baseDeps());
    const missing = await handler(new Request('https://example.test', { method: 'POST' }));
    const short = await handler(request('x'));
    const wrong = await handler(request('push-worker-secret-valuE'));

    expect([missing.status, short.status, wrong.status]).toEqual([401, 401, 401]);
  });

  test('receipt -> outbox -> due reminder -> delivery 순서와 1000/100/200/500 cap을 지킨다', async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        if (fn === 'lf_push_claim_receipts' || fn === 'lf_push_claim_deliveries') return [];
        if (fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        return {};
      },
    }));

    const response = await handler(request());

    expect(response.status).toBe(200);
    expect(calls.map((call) => call.fn)).toEqual([
      'lf_push_claim_receipts',
      'lf_notification_outbox_claim',
      'lf_dispatch_due_reminders',
      'lf_push_claim_deliveries',
    ]);
    expect(calls[0]?.args).toMatchObject({ p_limit: 1000 });
    expect(calls[1]?.args).toMatchObject({ p_limit: 1 });
    expect(calls[2]?.args).toMatchObject({ p_limit: 200 });
    expect(calls[3]?.args).toMatchObject({ p_limit: 500 });
  });

  test('delivery 201개를 Expo 요청 100/100/1개로 나누고 ticket 결과는 한 RPC 배열로 기록한다', async () => {
    const batches: number[] = [];
    const records: unknown[] = [];
    const rpcCalls: string[] = [];
    const claimed = Array.from({ length: 201 }, (_, index) => delivery(index + 1));
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        rpcCalls.push(fn);
        if (fn === 'lf_push_claim_receipts') return [];
        if (fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        if (fn === 'lf_push_claim_deliveries') return claimed;
        if (fn === 'lf_push_record_tickets') {
          records.push(args['p_results']);
          return { accepted: 201, ignored: 0, ticketed: 201, retried: 0, failed: 0, notification_ids: ['11111111-1111-4111-8111-111111111111'] };
        }
        if (fn === 'lf_push_refresh_notification_status') return { sent: 0, failed: 0, pending: 1 };
        return {};
      },
      fetch: async (_url, init) => {
        const payload = JSON.parse(String(init?.body)) as unknown[];
        batches.push(payload.length);
        return new Response(JSON.stringify({ data: payload.map((_, index) => ({ status: 'ok', id: `ticket-${batches.length}-${index}` })) }), { status: 200 });
      },
    }));

    const response = await handler(request());

    expect(response.status).toBe(200);
    expect(batches).toEqual([100, 100, 1]);
    expect(records).toHaveLength(1);
    expect(records[0]).toHaveLength(201);
    expect(rpcCalls).not.toContain('lf_push_refresh_notification_status');
  });

  test('Expo data에는 검증 가능한 내비게이션 세 필드만 직렬화한다', async () => {
    let expoPayload: unknown = null;
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        if (fn === 'lf_push_claim_receipts') return [];
        if (fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') {
          return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        }
        if (fn === 'lf_push_claim_deliveries') return [delivery(1)];
        if (fn === 'lf_push_record_tickets') {
          return { accepted: 1, ignored: 0, ticketed: 1, retried: 0, failed: 0 };
        }
        return args;
      },
      fetch: async (_url, init) => {
        expoPayload = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'ticket-1' }] }), {
          status: 200,
        });
      },
    }));

    await handler(request());

    expect(expoPayload).toEqual([
      {
        to: 'ExponentPushToken[sensitive-1]',
        title: '민감 제목 1',
        body: '민감 본문 1',
        data: {
          notification_id: '11111111-1111-4111-8111-111111111111',
          deeplink: 'SCR-A05',
          promise_id: '44444444-4444-4444-8444-444444444444',
        },
      },
    ]);
  });

  test('429는 retry, MessageRateExceeded는 retry, payload와 credential 오류는 permanent로 분류한다', async () => {
    const recorded: Record<string, unknown>[] = [];
    let sendCall = 0;
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        if (fn === 'lf_push_claim_receipts') return [];
        if (fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        if (fn === 'lf_push_claim_deliveries') return [delivery(1), delivery(2), delivery(3), delivery(4)];
        if (fn === 'lf_push_record_tickets') {
          recorded.push(...(args['p_results'] as Record<string, unknown>[]));
          return { accepted: 4, ignored: 0, ticketed: 0, retried: 2, failed: 2, notification_ids: [] };
        }
        return {};
      },
      fetch: async () => {
        sendCall += 1;
        if (sendCall === 1) return new Response('', { status: 429 });
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      },
    }));

    await handler(request());
    expect(recorded).toHaveLength(4);
    expect(recorded.every((result) => result['outcome'] === 'retry')).toBe(true);

    recorded.length = 0;
    const errorHandler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        if (fn === 'lf_push_claim_receipts') return [];
        if (fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        if (fn === 'lf_push_claim_deliveries') return [delivery(1), delivery(2), delivery(3)];
        if (fn === 'lf_push_record_tickets') {
          recorded.push(...(args['p_results'] as Record<string, unknown>[]));
          return { accepted: 3, ignored: 0, ticketed: 0, retried: 1, failed: 2, notification_ids: [] };
        }
        return {};
      },
      fetch: async () => new Response(JSON.stringify({ data: [
        { status: 'error', details: { error: 'MessageRateExceeded' } },
        { status: 'error', details: { error: 'MessageTooBig' } },
        { status: 'error', details: { error: 'InvalidCredentials' } },
      ] }), { status: 200 }),
    }));
    await errorHandler(request());
    expect(recorded.map((result) => [result['outcome'], result['error_code']])).toEqual([
      ['retry', 'MessageRateExceeded'],
      ['failed', 'MessageTooBig'],
      ['failed', 'InvalidCredentials'],
    ]);
  });

  test('receipt 누락은 즉시 ReceiptUnavailable, receipt의 rate limit만 retry로 기록한다', async () => {
    const recorded: Record<string, unknown>[] = [];
    const receiptRows = Array.from({ length: 4 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      notification_id: '11111111-1111-4111-8111-111111111111',
      device_token_id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
      expo_ticket_id: `receipt-${index + 1}`,
      lease_id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`,
    }));
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        if (fn === 'lf_push_claim_receipts') return receiptRows;
        if (fn === 'lf_push_record_receipts') {
          recorded.push(...(args['p_results'] as Record<string, unknown>[]));
          return { accepted: 4, ignored: 0, delivered: 1, retried: 1, failed: 2, notification_ids: [] };
        }
        if (fn === 'lf_notification_outbox_claim' || fn === 'lf_push_claim_deliveries') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        return {};
      },
      fetch: async () => new Response(JSON.stringify({ data: {
        'receipt-1': { status: 'ok' },
        'receipt-2': { status: 'error', details: { error: 'MessageRateExceeded' } },
        'receipt-3': { status: 'error', details: { error: 'DeviceNotRegistered' } },
      } }), { status: 200 }),
    }));
    await handler(request());
    expect(recorded.map((result) => [result['outcome'], result['error_code'] ?? null])).toEqual([
      ['delivered', null],
      ['failed', 'MessageRateExceeded'],
      ['failed', 'DeviceNotRegistered'],
      ['failed', 'ReceiptUnavailable'],
    ]);
  });

  test('사용 가능한 lease의 잘못된 payload는 실패로 기록하고 같은 claim의 정상 payload는 보낸다', async () => {
    const malformed: Record<string, unknown> = {
      ...delivery(1),
      deeplink: 'https://evil.example',
    };
    const recorded: Record<string, unknown>[] = [];
    const sentBodies: unknown[] = [];
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        if (fn === 'lf_push_claim_receipts' || fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') {
          return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        }
        if (fn === 'lf_push_claim_deliveries') return [malformed, delivery(2)];
        if (fn === 'lf_push_record_tickets') {
          recorded.push(...(args['p_results'] as Record<string, unknown>[]));
          return { accepted: 2, ignored: 0, ticketed: 1, retried: 0, failed: 1 };
        }
        return {};
      },
      fetch: async (_url, init) => {
        sentBodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'valid-ticket' }] }), {
          status: 200,
        });
      },
    }));

    expect((await handler(request())).status).toBe(200);
    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0]).toHaveLength(1);
    expect(recorded.map((result) => ({
      delivery_id: result['delivery_id'],
      outcome: result['outcome'],
      error_code: result['error_code'] ?? null,
      attempted: result['attempted'],
    }))).toEqual([
      {
        delivery_id: malformed['id'],
        outcome: 'failed',
        error_code: 'PayloadInvalid',
        attempted: false,
      },
      {
        delivery_id: delivery(2)['id'],
        outcome: 'ticket',
        error_code: null,
        attempted: true,
      },
    ]);
  });

  test.each([
    ['lf_push_claim_receipts', ['lf_notification_outbox_claim', 'lf_dispatch_due_reminders', 'lf_push_claim_deliveries']],
    ['lf_push_record_receipts', ['lf_notification_outbox_claim', 'lf_dispatch_due_reminders', 'lf_push_claim_deliveries']],
    ['lf_notification_outbox_claim', ['lf_dispatch_due_reminders', 'lf_push_claim_deliveries']],
    ['lf_notification_outbox_record', ['lf_dispatch_due_reminders', 'lf_push_claim_deliveries']],
    ['lf_dispatch_due_reminders', ['lf_push_claim_deliveries']],
    ['lf_push_claim_deliveries', []],
    ['lf_push_record_tickets', []],
  ] as const)('%s 실패를 격리하고 남은 budget의 뒤 stage를 계속 실행한다', async (failedRpc, laterRpcs) => {
    const calls: string[] = [];
    const logs: unknown[] = [];
    let outboxClaimCount = 0;
    const receipt = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      notification_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      device_token_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      expo_ticket_id: 'receipt-ticket',
      lease_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    };
    const outbox = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      recipient_user_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      promise_id: '44444444-4444-4444-8444-444444444444',
      event: 'NT-07',
      template_args: { promiseTitle: '민감 약속 제목' },
      inapp_dedupe_key: 'safe-inapp',
      push_dedupe_key: 'safe-push',
      lease_id: '12121212-1212-4121-8121-121212121212',
    };
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn) => {
        calls.push(fn);
        if (fn === failedRpc) throw new Error('sensitive database failure detail');
        if (fn === 'lf_push_claim_receipts') return [receipt];
        if (fn === 'lf_push_record_receipts') {
          return { accepted: 1, delivered: 1, retried: 0, failed: 0 };
        }
        if (fn === 'lf_notification_outbox_claim') {
          outboxClaimCount += 1;
          return outboxClaimCount === 1 ? [outbox] : [];
        }
        if (fn === 'lf_notification_outbox_record') return {};
        if (fn === 'lf_notification_fanout') return {};
        if (fn === 'lf_dispatch_due_reminders') {
          return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        }
        if (fn === 'lf_push_claim_deliveries') return [delivery(1)];
        if (fn === 'lf_push_record_tickets') {
          return { accepted: 1, ticketed: 1, retried: 0, failed: 0 };
        }
        return {};
      },
      fetch: async (url) => String(url).includes('getReceipts')
        ? new Response(JSON.stringify({ data: { 'receipt-ticket': { status: 'ok' } } }), { status: 200 })
        : new Response(JSON.stringify({ data: [{ status: 'ok', id: 'delivery-ticket' }] }), { status: 200 }),
      log: { error: (message, detail) => logs.push({ message, detail }) },
    }));

    const response = await handler(request());

    expect(response.status).toBe(200);
    for (const rpc of laterRpcs) expect(calls).toContain(rpc);
    const output = `${await response.text()} ${JSON.stringify(logs)}`;
    expect(output).not.toContain('sensitive database failure detail');
    expect(output).not.toContain('민감 약속 제목');
    expect(output).not.toContain('ExponentPushToken');
  });

  test('45초 budget에 닿으면 다음 stage를 claim하지 않는다', async () => {
    const calls: string[] = [];
    let clock = 0;
    const handler = createPushSendHandler(baseDeps({
      elapsedMs: () => clock,
      rpc: async (fn) => {
        calls.push(fn);
        if (fn === 'lf_push_claim_receipts') {
          clock = 45_000;
          return [];
        }
        return {};
      },
    }));

    const response = await handler(request());

    expect(response.status).toBe(200);
    expect(calls).toEqual(['lf_push_claim_receipts']);
  });

  test('44초대에 시작한 outbox가 deadline 도달 뒤 record나 다음 item을 claim하지 않는다', async () => {
    let clock = 0;
    let outboxClaims = 0;
    let outboxRecords = 0;
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      recipient_user_id: '22222222-2222-4222-8222-222222222222',
      promise_id: '33333333-3333-4333-8333-333333333333',
      event: 'NT-01',
      template_args: { partnerNickname: '민준', promiseTitle: '매일 걷기' },
      inapp_dedupe_key: 'deadline-inapp',
      push_dedupe_key: 'deadline-push',
      lease_id: '44444444-4444-4444-8444-444444444444',
    };
    const handler = createPushSendHandler(baseDeps({
      elapsedMs: () => clock,
      rpc: async (fn) => {
        if (fn === 'lf_push_claim_receipts') {
          clock = 44_000;
          return [];
        }
        if (fn === 'lf_notification_outbox_claim') {
          outboxClaims += 1;
          return outboxClaims === 1 ? [row] : [];
        }
        if (fn === 'lf_notification_fanout') {
          clock = 45_000;
          return {};
        }
        if (fn === 'lf_notification_outbox_record') {
          outboxRecords += 1;
          return {};
        }
        return {};
      },
    }));

    expect((await handler(request())).status).toBe(200);
    expect({ outboxClaims, outboxRecords }).toEqual({ outboxClaims: 1, outboxRecords: 0 });
  });

  test('warm worker가 오래 살아 있어도 invocation budget은 요청마다 새로 시작한다', async () => {
    const calls: string[] = [];
    const handler = createPushSendHandler(baseDeps({
      elapsedMs: () => 100_000,
      rpc: async (fn) => {
        calls.push(fn);
        if (fn === 'lf_push_claim_receipts' || fn === 'lf_notification_outbox_claim' || fn === 'lf_push_claim_deliveries') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        return {};
      },
    }));
    expect((await handler(request())).status).toBe(200);
    expect(calls[0]).toBe('lf_push_claim_receipts');
  });

  test('Expo 요청은 10초에 abort되고 응답과 로그에 token/payload/secret을 남기지 않는다', async () => {
    vi.useFakeTimers();
    const logs: unknown[] = [];
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        if (fn === 'lf_push_claim_receipts') return [];
        if (fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        if (fn === 'lf_push_claim_deliveries') return [delivery(1)];
        if (fn === 'lf_push_record_tickets') return { accepted: 1, ignored: 0, ticketed: 0, retried: 1, failed: 0, notification_ids: [] };
        return {};
      },
      fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('network detail with credentials')));
      }),
      log: { error: (message, detail) => logs.push({ message, detail }) },
    }));
    const pending = handler(request());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await pending;
    vi.useRealTimers();

    const allOutput = `${await response.text()} ${JSON.stringify(logs)}`;
    expect(allOutput).not.toContain('ExponentPushToken');
    expect(allOutput).not.toContain('민감 제목');
    expect(allOutput).not.toContain('민감 본문');
    expect(allOutput).not.toContain(SECRET);
    expect(allOutput).not.toContain('credentials');
  });

  test('fetch headers 뒤 멈춘 response body도 같은 10초 deadline으로 abort한다', async () => {
    vi.useFakeTimers();
    const recorded: Record<string, unknown>[] = [];
    let markBodyStarted: (() => void) | undefined;
    const bodyStarted = new Promise<void>((resolve) => { markBodyStarted = resolve; });
    const handler = createPushSendHandler(baseDeps({
      rpc: async (fn, args) => {
        if (fn === 'lf_push_claim_receipts') return [];
        if (fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        if (fn === 'lf_push_claim_deliveries') return [delivery(1)];
        if (fn === 'lf_push_record_tickets') {
          recorded.push(...(args['p_results'] as Record<string, unknown>[]));
          return { accepted: 1, ignored: 0, ticketed: 0, retried: 1, failed: 0, notification_ids: [] };
        }
        return {};
      },
      fetch: async (_url, init) => ({
        ok: true,
        status: 200,
        json: async () => new Promise<unknown>((_resolve, reject) => {
          markBodyStarted?.();
          init?.signal?.addEventListener('abort', () => reject(new Error('body aborted')));
        }),
      }) as Response,
    }));
    const pending = handler(request());
    await bodyStarted;
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).status).toBe(200);
    vi.useRealTimers();
    expect(recorded).toMatchObject([{ outcome: 'retry', error_code: 'NETWORK_ERROR' }]);
  });

  test('남은 invocation budget이 10초보다 짧으면 그 시점에 Expo 요청을 abort한다', async () => {
    vi.useFakeTimers();
    let clock = 0;
    let markFetchStarted: (() => void) | undefined;
    const fetchStarted = new Promise<void>((resolve) => { markFetchStarted = resolve; });
    const handler = createPushSendHandler(baseDeps({
      elapsedMs: () => clock,
      rpc: async (fn, args) => {
        if (fn === 'lf_push_claim_receipts') return [];
        if (fn === 'lf_notification_outbox_claim') return [];
        if (fn === 'lf_dispatch_due_reminders') return { claimed: 0, sent: 0, canceled: 0, deferred: 0 };
        if (fn === 'lf_push_claim_deliveries') {
          clock = 40_000;
          return [delivery(1)];
        }
        if (fn === 'lf_push_record_tickets') return { accepted: 1, ignored: 0, ticketed: 0, retried: 1, failed: 0, notification_ids: [] };
        return {};
      },
      fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        markFetchStarted?.();
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
    }));
    const pending = handler(request());
    await fetchStarted;
    await vi.advanceTimersByTimeAsync(4_999);
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).status).toBe(200);
    vi.useRealTimers();
  });
});
