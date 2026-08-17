import * as Crypto from 'expo-crypto';

import {
  acknowledgeCompletionCelebrationShownWith,
  claimCompletionCelebrationWith,
} from './completion-celebration-api.ts';
import {
  claimCompletionCelebration as claimCompletionCelebrationWithLifecycle,
  markCompletionCelebrationShown as markCompletionCelebrationShownWithLifecycle,
  type CompletionCelebrationClaimDeps,
} from './completion-celebration-claim.ts';
import {
  callMobileFunctionNative,
  currentMobileUserId,
} from './mobile-api-native.ts';
import { getMobileEncryptedStorage } from './supabase-native.ts';

const apiDeps = { call: callMobileFunctionNative };

function lifecycleDeps(): CompletionCelebrationClaimDeps {
  return {
    currentUserId: currentMobileUserId,
    randomUuid: () => Crypto.randomUUID(),
    storage: getMobileEncryptedStorage(),
    claimWith: async (promiseId, idempotencyKey) =>
      await claimCompletionCelebrationWith(promiseId, idempotencyKey, apiDeps),
    acknowledgeShownWith: async (promiseId, claimId, idempotencyKey) =>
      await acknowledgeCompletionCelebrationShownWith(
        promiseId,
        claimId,
        idempotencyKey,
        apiDeps,
      ),
  };
}

export async function claimCompletionCelebration(promiseId: string) {
  return await claimCompletionCelebrationWithLifecycle(promiseId, lifecycleDeps());
}

export async function markCompletionCelebrationShown(
  promiseId: string,
  claimId: string,
): Promise<void> {
  await markCompletionCelebrationShownWithLifecycle(promiseId, claimId, lifecycleDeps());
}
