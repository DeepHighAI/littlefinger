import type {
  FulfillmentSubmitRequest,
  FulfillmentSubmitResponse,
  ParticipantPromiseSummary,
  PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';

import {
  listParticipantPromises as listParticipantPromisesWith,
  loadFulfillmentDetail as loadFulfillmentDetailWith,
  reopenFulfillment as reopenFulfillmentWith,
  submitFulfillment as submitFulfillmentWith,
} from './fulfillment-api.ts';
import { callMobileFunctionNative } from './mobile-api-native.ts';

const deps = { call: callMobileFunctionNative };

export async function listParticipantPromises(): Promise<
  ParticipantPromiseSummary[]
> {
  return await listParticipantPromisesWith(deps);
}

export async function loadFulfillmentDetail(
  promiseId: string,
): Promise<PromiseFulfillmentDetailResponse> {
  return await loadFulfillmentDetailWith(promiseId, deps);
}

export async function submitFulfillment(
  input: FulfillmentSubmitRequest,
): Promise<FulfillmentSubmitResponse> {
  return await submitFulfillmentWith(input, deps);
}

export async function reopenFulfillment(promiseId: string) {
  return await reopenFulfillmentWith(promiseId, deps);
}
