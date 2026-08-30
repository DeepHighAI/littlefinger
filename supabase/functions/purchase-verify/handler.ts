import {
  PERMANENT_ACCESS_PRODUCT_ID,
  SLOT_PRODUCT_ID,
} from '../../../packages/shared/src/config.ts';
import { asPromiseEntitlementsView } from '../../../packages/shared/src/monetization.ts';
import { asSlotStatusResponse } from '../../../packages/shared/src/slots.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { uuidField } from '../_shared/monetization.ts';
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

      // 파는 상품은 슬롯과 약속별 영구 보관 둘뿐이다. 다른 상품 ID 는 우리 클라이언트가 보낸
      // 요청이 아니다.
      if (productId !== SLOT_PRODUCT_ID && productId !== PERMANENT_ACCESS_PRODUCT_ID) {
        throw new ApiError('E_VALIDATION', { field: 'product_id' });
      }
      // UUID 가 아닌 값은 RPC 의 uuid 캐스팅에서 죽어 500 이 된다 — 여기서 422 로 끝낸다.
      const promiseId = productId === PERMANENT_ACCESS_PRODUCT_ID
        ? uuidField(body, 'promise_id')
        : null;

      const purchase = await deps.verifyPurchase(productId, purchaseToken);

      // 네 갈래 전부 같은 답이다 — 어느 검사에서 걸렸는지를 응답으로 구분해 주면
      // 위조 시도에 진행률 표시기를 달아 주는 셈이다.
      if (
        purchase === null ||
        purchase.purchaseState !== 0 ||
        purchase.orderId === null ||
        purchase.obfuscatedExternalAccountId !== actor ||
        (productId === PERMANENT_ACCESS_PRODUCT_ID &&
          purchase.obfuscatedExternalProfileId !== promiseId)
      ) {
        throw new ApiError('E_VALIDATION', { field: 'purchase_token' });
      }

      const purchaseTime =
        purchase.purchaseTimeMillis === null
          ? deps.now().toISOString()
          : new Date(Number(purchase.purchaseTimeMillis)).toISOString();

      const raw = await deps.rpc(
        productId === SLOT_PRODUCT_ID ? 'lf_slot_grant' : 'lf_permanent_access_grant', {
          p_user_id: actor,
          ...(productId === PERMANENT_ACCESS_PRODUCT_ID
            ? { p_promise_id: promiseId }
            : {}),
          p_product_id: productId,
          p_order_id: purchase.orderId,
          p_purchase_token: purchaseToken,
          p_purchase_time: purchaseTime,
        },
      );
      const payload = productId === SLOT_PRODUCT_ID
        ? asSlotStatusResponse(raw)
        : asPromiseEntitlementsView(raw);
      if (payload === null) throw new Error('INVALID_PURCHASE_GRANT_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
