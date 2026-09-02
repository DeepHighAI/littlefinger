import {
  PERMANENT_ACCESS_PRODUCT_ID,
  SLOT_PRODUCT_ID,
  type PromiseEntitlementsView,
  type SlotStatusResponse,
} from '@littlefinger/shared';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'expo-iap';

import { currentMobileUserId } from './mobile-api-native.ts';
import { verifyPermanentAccessPurchaseNative, verifySlotPurchaseNative } from './slots-native.ts';

/** 사용자가 스토어 시트를 닫은 경우 — 오류로 표시하지 않는다. */
export class SlotPurchaseCancelledError extends Error {
  constructor() {
    super('slot purchase cancelled');
    this.name = 'SlotPurchaseCancelledError';
  }
}

// initConnection 은 앱 수명 동안 한 번이면 된다. 실패한 시도는 캐시에서 지워 재시도가 가능하다.
let connection: Promise<unknown> | null = null;

async function ensureConnection(): Promise<void> {
  connection ??= initConnection().catch((error: unknown) => {
    connection = null;
    throw error;
  });
  await connection;
}

/** 스토어 현지화 가격. 조회 실패는 `null` — 화면이 기본값 표기로 대체한다. */
export async function loadSlotPrice(): Promise<string | null> {
  try {
    await ensureConnection();
    const products = await fetchProducts({ skus: [SLOT_PRODUCT_ID], type: 'in-app' });
    const product = (products ?? []).find((entry) => entry.id === SLOT_PRODUCT_ID);
    return product?.displayPrice.trim() || null;
  } catch {
    return null;
  }
}

export async function loadPermanentAccessPrice(): Promise<string | null> {
  try {
    await ensureConnection();
    const products = await fetchProducts({ skus: [PERMANENT_ACCESS_PRODUCT_ID], type: 'in-app' });
    const product = (products ?? []).find((entry) => entry.id === PERMANENT_ACCESS_PRODUCT_ID);
    return product?.displayPrice.trim() || null;
  } catch {
    return null;
  }
}

/**
 * 검증 → 부여 → 소모. 순서가 계약이다: 서버 200 을 받기 전에 소모하면 검증 실패 시
 * 돈만 나가고, 소모 전에 앱이 죽으면 미소모 구매로 남아 `reconcileSlotPurchases` 가 줍는다.
 */
async function verifyAndConsume(purchase: Purchase): Promise<SlotStatusResponse> {
  const token = purchase.purchaseToken ?? null;
  if (token === null) throw new Error('SLOT_PURCHASE_TOKEN_MISSING');
  const status = await verifySlotPurchaseNative(purchase.productId, token);
  await finishTransaction({ purchase, isConsumable: true });
  return status;
}

async function verifyPermanentAndConsume(
  purchase: Purchase,
  promiseId: string,
): Promise<PromiseEntitlementsView> {
  const token = purchase.purchaseToken ?? null;
  if (token === null) throw new Error('PERMANENT_ACCESS_PURCHASE_TOKEN_MISSING');
  const entitlements = await verifyPermanentAccessPurchaseNative(
    promiseId,
    purchase.productId,
    token,
  );
  await finishTransaction({ purchase, isConsumable: true });
  return entitlements;
}

// 결제는 이벤트로 돌아온다 — 진행 중 재진입은 리스너를 두 벌 만들므로 막는다.
let purchaseInFlight = false;

async function requestGooglePurchase(
  productId: string,
  userId: string,
  profileId?: string,
): Promise<Purchase> {
  return await new Promise<Purchase>((resolve, reject) => {
    const updated = purchaseUpdatedListener((event) => {
      cleanup();
      resolve(event);
    });
    const failed = purchaseErrorListener((error) => {
      cleanup();
      reject(
        error.code === ErrorCode.UserCancelled
          ? new SlotPurchaseCancelledError()
          : new Error(error.message),
      );
    });
    function cleanup(): void {
      updated.remove();
      failed.remove();
    }
    requestPurchase({
      request: {
        google: {
          skus: [productId],
          obfuscatedAccountId: userId,
          ...(profileId === undefined ? {} : { obfuscatedProfileId: profileId }),
        },
      },
      type: 'in-app',
    }).catch((error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

/**
 * 슬롯 1개 구매. 성공 시 부여가 끝난 슬롯 현황을 돌려준다.
 * 사용자 취소는 `SlotPurchaseCancelledError` — 호출부는 조용히 무시한다.
 */
export async function purchaseSlot(): Promise<SlotStatusResponse> {
  if (purchaseInFlight) throw new SlotPurchaseCancelledError();
  purchaseInFlight = true;
  try {
    const userId = await currentMobileUserId();
    await ensureConnection();

    // 계정 바인딩 — purchase-verify 가 obfuscatedExternalAccountId 로 대조한다.
    const purchase = await requestGooglePurchase(SLOT_PRODUCT_ID, userId);

    return await verifyAndConsume(purchase);
  } finally {
    purchaseInFlight = false;
  }
}

export async function purchasePermanentAccess(
  promiseId: string,
): Promise<PromiseEntitlementsView> {
  if (purchaseInFlight) throw new SlotPurchaseCancelledError();
  purchaseInFlight = true;
  try {
    const userId = await currentMobileUserId();
    await ensureConnection();
    const purchase = await requestGooglePurchase(PERMANENT_ACCESS_PRODUCT_ID, userId, promiseId);
    return await verifyPermanentAndConsume(purchase, promiseId);
  } finally {
    purchaseInFlight = false;
  }
}

/**
 * 미소모 구매 복구 — 검증과 소모 사이에서 앱이 죽은 경우의 출구.
 * 부여는 주문 ID 멱등이라 재검증이 이중 부여를 만들지 않는다. 실패는 삼킨다:
 * 복구가 안 되는 것이 결제 시트를 여는 것을 막아서는 안 된다.
 */
export async function reconcileSlotPurchases(): Promise<SlotStatusResponse | null> {
  try {
    await ensureConnection();
    const purchases = await getAvailablePurchases();
    let latest: SlotStatusResponse | null = null;
    for (const purchase of purchases ?? []) {
      if (purchase.productId !== SLOT_PRODUCT_ID) continue;
      try {
        latest = await verifyAndConsume(purchase);
      } catch {
        // 검증 불가 구매(환불·위조)는 소모하지 않고 남긴다 — 소모는 곧 슬롯 없이 결제 종결이다.
      }
    }
    return latest;
  } catch {
    return null;
  }
}

/** 구매 시 obfuscatedProfileId 에 넣은 약속 ID — Android 영수증에서만 돌아온다. */
function boundPromiseIdOf(purchase: Purchase): string | null {
  return 'obfuscatedProfileIdAndroid' in purchase
    ? purchase.obfuscatedProfileIdAndroid ?? null
    : null;
}

/**
 * 영구 보관 결제도 검증과 소모 사이의 앱 종료에서 복구한다.
 * 이 약속에 바인딩된 구매만 검증한다 — 다른 약속의 미소모 구매를 여기서 소모하면
 * 그 약속은 결제만 되고 혜택은 못 받는다.
 */
export async function reconcilePermanentAccessPurchase(
  promiseId: string,
): Promise<PromiseEntitlementsView | null> {
  try {
    await ensureConnection();
    const purchases = await getAvailablePurchases();
    let latest: PromiseEntitlementsView | null = null;
    for (const purchase of purchases ?? []) {
      if (purchase.productId !== PERMANENT_ACCESS_PRODUCT_ID) continue;
      if (boundPromiseIdOf(purchase) !== promiseId) continue;
      try {
        latest = await verifyPermanentAndConsume(purchase, promiseId);
      } catch {
        // 약속 바인딩이나 서버 검증에 실패한 구매는 소모하지 않는다.
      }
    }
    return latest;
  } catch {
    return null;
  }
}
