import type { PurchaseVerifyResponse, SlotStatusResponse } from '@littlefinger/shared';

import { callMobileFunctionNative } from './mobile-api-native.ts';
import { fetchSlotStatus, verifySlotPurchase } from './slots-api.ts';

const deps = {
  call: callMobileFunctionNative,
};

export async function loadSlotStatus(): Promise<SlotStatusResponse> {
  return await fetchSlotStatus(deps);
}

export async function verifySlotPurchaseNative(
  productId: string,
  purchaseToken: string,
): Promise<PurchaseVerifyResponse> {
  return await verifySlotPurchase(productId, purchaseToken, deps);
}
