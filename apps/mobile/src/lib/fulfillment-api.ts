import {
  ENDPOINT,
  type EvidenceSignUrlRequest,
  type EvidenceSignUrlResponse,
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

export interface EvidenceDiscardResponse {
  upload_id: string;
  status: 'DISCARDED';
}

type EvidenceVariant = EvidenceSignUrlRequest['variant'];

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
  idempotencyKey: string,
  deps: FulfillmentApiDeps,
): Promise<FulfillmentSubmitResponse> {
  return await deps.call(
    ENDPOINT.fulfillmentSubmit,
    input,
    { idempotent: true, idempotencyKey },
  );
}

export async function reopenFulfillment(
  promiseId: string,
  idempotencyKey: string,
  deps: FulfillmentApiDeps,
): Promise<FulfillmentReopenResponse> {
  return await deps.call(
    ENDPOINT.fulfillmentReopen,
    { promise_id: promiseId },
    { idempotent: true, idempotencyKey },
  );
}

export async function discardFulfillmentEvidence(
  uploadId: string,
  idempotencyKey: string,
  deps: FulfillmentApiDeps,
): Promise<EvidenceDiscardResponse> {
  return await deps.call(
    ENDPOINT.evidenceDiscard,
    { upload_id: uploadId },
    { idempotent: true, idempotencyKey },
  );
}

export async function signFulfillmentEvidence(
  evidenceId: string,
  variant: EvidenceVariant,
  deps: FulfillmentApiDeps,
): Promise<EvidenceSignUrlResponse> {
  return await deps.call(
    ENDPOINT.evidenceSignUrl,
    { evidence_id: evidenceId, variant },
    { idempotent: false },
  );
}
