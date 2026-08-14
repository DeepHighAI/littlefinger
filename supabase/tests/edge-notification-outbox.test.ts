import { describe, expect, test } from 'vitest';

import { processNotificationOutbox } from '../functions/_shared/outbox.ts';

const OUTBOX_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  recipient_user_id: '22222222-2222-4222-8222-222222222222',
  promise_id: '33333333-3333-4333-8333-333333333333',
  event: 'NT-01',
  template_args: { partnerNickname: '민준', promiseTitle: '매일 걷기' },
  body_snapshot: null,
  inapp_dedupe_key: 'inapp-key',
  push_dedupe_key: 'push-key',
  status: 'LEASED',
  attempt_count: 1,
  lease_id: '44444444-4444-4444-8444-444444444444',
  lease_expires_at: '2026-08-14T00:01:00.000Z',
};

describe('notification outbox TypeScript 소비자', () => {
  test('공유 렌더러 결과로 fanout한 뒤 같은 lease에 성공을 기록한다', async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const result = await processNotificationOutbox(
      {
        rpc: async (fn, args) => {
          calls.push({ fn, args });
          if (fn === 'lf_notification_outbox_claim') return [OUTBOX_ROW];
          return {};
        },
        log: { error: () => {} },
        now: () => new Date('2026-08-14T00:00:00.000Z'),
      },
      { limit: 1 },
    );

    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(calls).toEqual([
      {
        fn: 'lf_notification_outbox_claim',
        args: {
          p_now: '2026-08-14T00:00:00.000Z',
          p_limit: 1,
          p_lease_seconds: 60,
        },
      },
      {
        fn: 'lf_notification_fanout',
        args: {
          p_user_id: OUTBOX_ROW.recipient_user_id,
          p_promise_id: OUTBOX_ROW.promise_id,
          p_type: 'NT-01',
          p_title: '민준님이 손가락 걸었어요! 약속 성립',
          p_body: '매일 걷기',
          p_deeplink: 'SCR-A05',
          p_inapp_dedupe_key: 'inapp-key',
          p_push_dedupe_key: 'push-key',
          p_now: '2026-08-14T00:00:00.000Z',
        },
      },
      {
        fn: 'lf_notification_outbox_record',
        args: {
          p_outbox_id: OUTBOX_ROW.id,
          p_lease_id: OUTBOX_ROW.lease_id,
          p_success: true,
          p_body_snapshot: '매일 걷기',
          p_error_code: null,
          p_now: '2026-08-14T00:00:00.000Z',
        },
      },
    ]);
  });

  test('fanout 실패를 격리하고 본문 스냅샷과 오류 코드로 재시도를 예약한다', async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const logs: string[] = [];
    const result = await processNotificationOutbox(
      {
        rpc: async (fn, args) => {
          calls.push({ fn, args });
          if (fn === 'lf_notification_outbox_claim') return [OUTBOX_ROW];
          if (fn === 'lf_notification_fanout') throw new Error('database detail must not leak');
          return {};
        },
        log: { error: (message) => logs.push(message) },
        now: () => new Date('2026-08-14T00:00:00.000Z'),
      },
      { limit: 1 },
    );

    expect(result).toEqual({ claimed: 1, processed: 0, failed: 1 });
    expect(calls.at(-1)).toEqual({
      fn: 'lf_notification_outbox_record',
      args: {
        p_outbox_id: OUTBOX_ROW.id,
        p_lease_id: OUTBOX_ROW.lease_id,
        p_success: false,
        p_body_snapshot: '매일 걷기',
        p_error_code: 'FANOUT_FAILED',
        p_now: '2026-08-14T00:00:00.000Z',
      },
    });
    expect(logs).toEqual(['notification outbox processing failed']);
  });

  test('lease rollover의 stale record는 같은 worker의 다음 intent를 막지 않는다', async () => {
    const secondRow = {
      ...OUTBOX_ROW,
      id: '55555555-5555-4555-8555-555555555555',
      lease_id: '66666666-6666-4666-8666-666666666666',
      inapp_dedupe_key: 'second-inapp-key',
      push_dedupe_key: 'second-push-key',
    };
    const rolloverRow = {
      ...OUTBOX_ROW,
      lease_id: '77777777-7777-4777-8777-777777777777',
      attempt_count: 2,
      lease_expires_at: '2026-08-14T00:03:01.000Z',
    };
    let currentMs = Date.parse('2026-08-14T00:00:00.000Z');
    let claimCount = 0;
    let releaseFirstFanout: (() => void) | undefined;
    const firstFanoutBlocked = new Promise<void>((resolve) => {
      releaseFirstFanout = resolve;
    });
    let firstFanoutStarted: (() => void) | undefined;
    const firstFanoutReady = new Promise<void>((resolve) => {
      firstFanoutStarted = resolve;
    });
    const records: Record<string, unknown>[] = [];
    let fanoutCount = 0;
    const deps = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'lf_notification_outbox_claim') {
          claimCount += 1;
          if (claimCount === 1) return [OUTBOX_ROW];
          if (claimCount === 2) return [rolloverRow];
          if (claimCount === 3) return [secondRow];
          return [];
        }
        if (fn === 'lf_notification_fanout') {
          fanoutCount += 1;
          if (fanoutCount === 1) {
            firstFanoutStarted?.();
            await firstFanoutBlocked;
          }
          return {};
        }
        if (fn === 'lf_notification_outbox_record') {
          records.push(args);
          if (args['p_lease_id'] === OUTBOX_ROW.lease_id) throw new Error('E_STATE_CONFLICT');
          return {};
        }
        throw new Error(`unexpected RPC: ${fn}`);
      },
      log: { error: () => {} },
      now: () => new Date(currentMs),
    };

    const firstWorker = processNotificationOutbox(deps, { limit: 2 });
    await firstFanoutReady;
    currentMs = Date.parse('2026-08-14T00:02:01.000Z');
    const secondWorker = await processNotificationOutbox(deps, { limit: 1 });
    releaseFirstFanout?.();
    const firstResult = await firstWorker;

    expect(secondWorker).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(firstResult).toEqual({ claimed: 2, processed: 1, failed: 0 });
    expect(records.filter((args) => args['p_lease_id'] === OUTBOX_ROW.lease_id)).toEqual([
      expect.objectContaining({ p_success: true }),
    ]);
    expect(records.some((args) => args['p_outbox_id'] === secondRow.id)).toBe(true);
    expect(claimCount).toBe(3);
  });
});
