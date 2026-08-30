import {
  asSlotStatusResponse,
  type PromiseEntitlementsView,
  type SlotStatusResponse,
} from '@littlefinger/shared';

import { callMobileFunctionNative } from './mobile-api-native.ts';
import { fetchSlotStatus, verifyPermanentAccessPurchase, verifySlotPurchase } from './slots-api.ts';

const deps = {
  call: callMobileFunctionNative,
};

export async function loadSlotStatus(): Promise<SlotStatusResponse> {
  return await fetchSlotStatus(deps);
}

export async function verifyPermanentAccessPurchaseNative(
  promiseId: string,
  productId: string,
  purchaseToken: string,
): Promise<PromiseEntitlementsView> {
  return await verifyPermanentAccessPurchase(promiseId, productId, purchaseToken, deps);
}

export async function verifySlotPurchaseNative(
  productId: string,
  purchaseToken: string,
): Promise<SlotStatusResponse> {
  const response = await verifySlotPurchase(productId, purchaseToken, deps);
  const status = asSlotStatusResponse(response);
  if (status === null) throw new Error('INVALID_SLOT_PURCHASE_RESPONSE');
  return status;
}
