import {
  REWARD_SSV_POLL_MS,
  REWARD_SSV_WAIT_MS,
  type PromiseEntitlementsView,
  type RewardAction,
} from '@littlefinger/shared';

import { readRewardedAdsEnabled } from './ads-config-native.ts';
import { showRewardedAd } from './admob-native.tsx';
import { callMobileFunctionNative } from './mobile-api-native.ts';
import {
  createRewardIntent,
  fetchPromiseEntitlements,
  fetchRewardStatus,
} from './monetization-api.ts';

const deps = { call: callMobileFunctionNative };

// UNAVAILABLE 은 종착 상태다 — 무료 대체 경로는 없고, 화면은 잠금 상태와 구매 안내만 보여준다.
export type RewardUnlockResult =
  | { phase: 'GRANTED'; entitlements: PromiseEntitlementsView }
  | { phase: 'PENDING'; intentId: string }
  | { phase: 'DISMISSED' }
  | { phase: 'UNAVAILABLE' };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getPromiseEntitlements(
  promiseId: string,
): Promise<PromiseEntitlementsView> {
  return await fetchPromiseEntitlements(promiseId, deps);
}

export async function unlockWithRewardedAd(
  promiseId: string,
  action: RewardAction,
): Promise<RewardUnlockResult> {
  if (!await readRewardedAdsEnabled()) return { phase: 'UNAVAILABLE' };
  const intent = await createRewardIntent(promiseId, action, deps);
  const ad = await showRewardedAd({
    action,
    opaqueUserId: intent.opaque_user_id,
    intentId: intent.intent_id,
  });
  if (ad === 'DISMISSED') return { phase: 'DISMISSED' };
  if (ad === 'UNAVAILABLE') return { phase: 'UNAVAILABLE' };

  const deadline = Date.now() + REWARD_SSV_WAIT_MS;
  do {
    const status = await fetchRewardStatus(intent.intent_id, deps);
    if (status.status === 'GRANTED' && status.entitlements !== null) {
      return { phase: 'GRANTED', entitlements: status.entitlements };
    }
    if (status.status === 'REJECTED') return { phase: 'UNAVAILABLE' };
    await wait(REWARD_SSV_POLL_MS);
  } while (Date.now() < deadline);
  return { phase: 'PENDING', intentId: intent.intent_id };
}
