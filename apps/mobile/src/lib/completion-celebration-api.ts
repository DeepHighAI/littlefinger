import {
  ENDPOINT,
  asCompletionCelebrationClaimResponse,
  asCompletionCelebrationShownResponse,
  type CompletionCelebrationClaimResponse,
  type CompletionCelebrationShownResponse,
  type Endpoint,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface CompletionCelebrationApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function claimCompletionCelebrationWith(
  promiseId: string,
  idempotencyKey: string,
  deps: CompletionCelebrationApiDeps,
): Promise<CompletionCelebrationClaimResponse> {
  const response = await deps.call<unknown>(
    ENDPOINT.completionCelebrationClaim,
    { promise_id: promiseId },
    { idempotent: true, idempotencyKey },
  );
  const parsed = asCompletionCelebrationClaimResponse(response);
  if (parsed === null) throw new Error('INVALID_COMPLETION_CELEBRATION_CLAIM_RESPONSE');
  return parsed;
}

export async function acknowledgeCompletionCelebrationShownWith(
  promiseId: string,
  claimId: string,
  idempotencyKey: string,
  deps: CompletionCelebrationApiDeps,
): Promise<CompletionCelebrationShownResponse> {
  const response = await deps.call<unknown>(
    ENDPOINT.completionCelebrationShown,
    { promise_id: promiseId, claim_id: claimId },
    { idempotent: true, idempotencyKey },
  );
  const parsed = asCompletionCelebrationShownResponse(response);
  if (parsed === null) throw new Error('INVALID_COMPLETION_CELEBRATION_SHOWN_RESPONSE');
  return parsed;
}
