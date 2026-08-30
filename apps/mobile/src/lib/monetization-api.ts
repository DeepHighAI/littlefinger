import {
  ENDPOINT,
  asPromiseEntitlementsView,
  asRewardIntentResponse,
  asRewardStatusResponse,
  type Endpoint,
  type PromiseEntitlementsView,
  type RewardAction,
  type RewardIntentResponse,
  type RewardStatusResponse,
} from '@littlefinger/shared';

export interface MonetizationApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: { idempotent?: boolean }): Promise<T>;
}

function required<T>(value: T | null): T {
  if (value === null) throw new Error('INVALID_MONETIZATION_RESPONSE');
  return value;
}

export async function fetchPromiseEntitlements(
  promiseId: string,
  deps: MonetizationApiDeps,
): Promise<PromiseEntitlementsView> {
  return required(asPromiseEntitlementsView(await deps.call(
    ENDPOINT.promiseEntitlements, { promise_id: promiseId }, { idempotent: false },
  )));
}

export async function createRewardIntent(
  promiseId: string,
  action: RewardAction,
  deps: MonetizationApiDeps,
): Promise<RewardIntentResponse> {
  return required(asRewardIntentResponse(await deps.call(
    ENDPOINT.rewardIntentCreate, { promise_id: promiseId, action }, { idempotent: false },
  )));
}

export async function fetchRewardStatus(
  intentId: string,
  deps: MonetizationApiDeps,
): Promise<RewardStatusResponse> {
  return required(asRewardStatusResponse(await deps.call(
    ENDPOINT.rewardStatus, { intent_id: intentId }, { idempotent: false },
  )));
}

