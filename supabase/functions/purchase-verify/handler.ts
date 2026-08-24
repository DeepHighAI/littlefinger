import { SLOT_PRODUCT_ID } from '../../../packages/shared/src/config.ts';
import { asSlotStatusResponse } from '../../../packages/shared/src/slots.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody, requiredString } from '../_shared/request.ts';
import type { GoogleProductPurchase } from './google.ts';

export interface PurchaseVerifyDeps extends Deps {
  /** Google Play Developer API 구매 조회. 유효하지 않은 영수증은 `null`, Google 장애는 throw. */
  verifyPurchase: (
    productId: string,
    purchaseToken: string,
  ) => Promise<GoogleProductPurchase | null>;
}

/**
 * 구매 검증 → 슬롯 부여 (PO 2026-08-24).
 *
 * 클라이언트 영수증은 신뢰하지 않는다 — 부여의 근거는 이 함수가 Google 에 직접 물어본
 * 결과뿐이다. `Idempotency-Key` 를 요구하지 않는 이유: 멱등의 자연 키가 이미 있다.
 * 같은 구매의 재검증은 같은 `orderId` 라서 `lf_slot_grant` 가 0행으로 흡수한다.
 * 클라이언트는 200 을 받은 뒤에만 스토어에 소모(consume) 처리를 한다.
 */
export function createPurchaseVerifyHandler(deps: PurchaseVerifyDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'purchase_token' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'purchase_token');
      const productId = requiredString(body, 'product_id', 'product_id');
      const purchaseToken = requiredString(body, 'purchase_token', 'purchase_token');

      // 파는 상품은 슬롯 하나뿐이다. 다른 상품 ID 는 우리 클라이언트가 보낸 요청이 아니다.
      if (productId !== SLOT_PRODUCT_ID) {
        throw new ApiError('E_VALIDATION', { field: 'product_id' });
      }

      const purchase = await deps.verifyPurchase(productId, purchaseToken);

      // 네 갈래 전부 같은 답이다 — 어느 검사에서 걸렸는지를 응답으로 구분해 주면
      // 위조 시도에 진행률 표시기를 달아 주는 셈이다.
      if (
        purchase === null ||
        purchase.purchaseState !== 0 ||
        purchase.orderId === null ||
        purchase.obfuscatedExternalAccountId !== actor
      ) {
        throw new ApiError('E_VALIDATION', { field: 'purchase_token' });
      }

      const purchaseTime =
        purchase.purchaseTimeMillis === null
          ? deps.now().toISOString()
          : new Date(Number(purchase.purchaseTimeMillis)).toISOString();

      const payload = asSlotStatusResponse(
        await deps.rpc('lf_slot_grant', {
          p_user_id: actor,
          p_product_id: productId,
          p_order_id: purchase.orderId,
          p_purchase_token: purchaseToken,
          p_purchase_time: purchaseTime,
        }),
      );
      if (payload === null) throw new Error('INVALID_SLOT_GRANT_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
