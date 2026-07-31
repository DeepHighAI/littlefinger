import {
  ENDPOINT,
  type Endpoint,
  type FulfillmentReopenResponse,
  type FulfillmentSubmitRequest,
  type FulfillmentSubmitResponse,
  type ParticipantPromiseSummary,
  type PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface FulfillmentApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function listParticipantPromises(
  deps: FulfillmentApiDeps,
): Promise<ParticipantPromiseSummary[]> {
  return await deps.call(
    ENDPOINT.participantPromiseList,
    {},
    { idempotent: false },
  );
}

export async function loadFulfillmentDetail(
  promiseId: string,
  deps: FulfillmentApiDeps,
): Promise<PromiseFulfillmentDetailResponse> {
  return await deps.call(
    ENDPOINT.promiseFulfillmentDetail,
    { promise_id: promiseId },
    { idempotent: false },
  );
}

export async function submitFulfillment(
  input: FulfillmentSubmitRequest,
  deps: FulfillmentApiDeps,
): Promise<FulfillmentSubmitResponse> {
  return await deps.call(
    ENDPOINT.fulfillmentSubmit,
    input,
    { idempotent: true },
  );
}

export async function reopenFulfillment(
  promiseId: string,
  deps: FulfillmentApiDeps,
): Promise<FulfillmentReopenResponse> {
  return await deps.call(
    ENDPOINT.fulfillmentReopen,
    { promise_id: promiseId },
    { idempotent: true },
  );
}
