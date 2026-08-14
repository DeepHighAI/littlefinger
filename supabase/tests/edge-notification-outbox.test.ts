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
      },
      { now: new Date('2026-08-14T00:00:00.000Z'), limit: 10 },
    );

    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(calls).toEqual([
      {
        fn: 'lf_notification_outbox_claim',
        args: {
          p_now: '2026-08-14T00:00:00.000Z',
          p_limit: 10,
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
      },
      { now: new Date('2026-08-14T00:00:00.000Z'), limit: 10 },
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
});
