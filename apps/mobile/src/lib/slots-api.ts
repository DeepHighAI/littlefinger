import {
  ENDPOINT,
  asPromiseEntitlementsView,
  asSlotStatusResponse,
  type Endpoint,
  type PurchaseVerifyResponse,
  type PromiseEntitlementsView,
  type SlotStatusResponse,
} from '@littlefinger/shared';

import { MobileApiError, type MobileApiOptions } from './mobile-api.ts';

export interface SlotsApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

const INVALID_RESPONSE_MESSAGE = '문제가 발생했어요. 잠시 후 다시 시도해 주세요.';

/** 서버 형태를 벗어난 응답은 성공으로 치지 않는다 — 결제 UI 가 임의 수치를 그리면 안 된다. */
function requireSlotStatus(value: unknown): SlotStatusResponse {
  const parsed = asSlotStatusResponse(value);
  if (parsed === null) throw new MobileApiError(null, INVALID_RESPONSE_MESSAGE);
  return parsed;
}

export async function fetchSlotStatus(deps: SlotsApiDeps): Promise<SlotStatusResponse> {
  return requireSlotStatus(await deps.call(ENDPOINT.slotStatus, {}, { idempotent: false }));
}

/**
 * 구매 검증 → 슬롯 부여. Idempotency-Key 를 싣지 않는다 — 같은 구매의 재검증은
 * Play 주문 ID 로 서버가 멱등 처리한다(20260824000001).
 */
export async function verifySlotPurchase(
  productId: string,
  purchaseToken: string,
  deps: SlotsApiDeps,
): Promise<PurchaseVerifyResponse> {
  return requireSlotStatus(
    await deps.call(
      ENDPOINT.purchaseVerify,
      { product_id: productId, purchase_token: purchaseToken },
      { idempotent: false },
    ),
  );
}

export async function verifyPermanentAccessPurchase(
  promiseId: string,
  productId: string,
  purchaseToken: string,
  deps: SlotsApiDeps,
): Promise<PromiseEntitlementsView> {
  const response = await deps.call<PurchaseVerifyResponse>(
    ENDPOINT.purchaseVerify,
    { product_id: productId, purchase_token: purchaseToken, promise_id: promiseId },
    { idempotent: false },
  );
  const parsed = asPromiseEntitlementsView(response);
  if (parsed === null) throw new MobileApiError(null, INVALID_RESPONSE_MESSAGE);
  return parsed;
}
