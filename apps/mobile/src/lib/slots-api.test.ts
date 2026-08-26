import { ENDPOINT } from '@littlefinger/shared';

import { MobileApiError, type MobileApiOptions } from './mobile-api.ts';
import { fetchSlotStatus, verifySlotPurchase, type SlotsApiDeps } from './slots-api.ts';

interface Call {
  endpoint: string;
  body: unknown;
  options: MobileApiOptions;
}

function depsOf(payload: unknown): { deps: SlotsApiDeps; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    deps: {
      call: async (endpoint, body, options) => {
        calls.push({ endpoint, body, options });
        return payload as never;
      },
    },
  };
}

describe('슬롯 API 래퍼', () => {
  test('현황 조회는 빈 본문으로 slot-status 를 부른다', async () => {
    const { deps, calls } = depsOf({ capacity: 5, used: 2 });

    await expect(fetchSlotStatus(deps)).resolves.toEqual({ capacity: 5, used: 2 });
    expect(calls).toEqual([
      { endpoint: ENDPOINT.slotStatus, body: {}, options: { idempotent: false } },
    ]);
  });

  test('구매 검증은 Idempotency-Key 없이 부른다 — 멱등은 서버의 주문 ID 몫이다', async () => {
    const { deps, calls } = depsOf({ capacity: 6, used: 5 });

    await expect(verifySlotPurchase('promise_slot_plus1', 'play-token', deps)).resolves.toEqual({
      capacity: 6,
      used: 5,
    });
    expect(calls).toEqual([
      {
        endpoint: ENDPOINT.purchaseVerify,
        body: { product_id: 'promise_slot_plus1', purchase_token: 'play-token' },
        options: { idempotent: false },
      },
    ]);
  });

  test('형태를 벗어난 응답은 성공으로 치지 않는다', async () => {
    const { deps } = depsOf({ capacity: 'many', used: 0 });

    await expect(fetchSlotStatus(deps)).rejects.toBeInstanceOf(MobileApiError);
  });
});
