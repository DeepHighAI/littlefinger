import {
  ENDPOINT,
  ERROR_HTTP_STATUS,
  IDEMPOTENCY_KEY_HEADER,
  type EvidenceDiscardRequest,
  type EvidenceSignUrlRequest,
  type EvidenceSignUrlResponse,
  type EvidenceUploadResponse,
  type FulfillmentReopenRequest,
  type FulfillmentReopenResponse,
  type FulfillmentSubmitRequest,
  type FulfillmentSubmitResponse,
  type ParticipantPromiseSummary,
  type PromiseFulfillmentDetailRequest,
  type PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';

import {
  messageForFailure,
  NO_RESPONSE,
  readFailure,
  type ApiFailure,
} from './api-failure.ts';
import { functionUrl } from './supabase.ts';

export class FulfillmentApiError extends Error {
  readonly authExpired: boolean;

  constructor(
    readonly failure: ApiFailure,
    readonly status: number | null,
  ) {
    super(messageForFailure(failure));
    this.name = 'FulfillmentApiError';
    this.authExpired =
      failure.code === 'E_AUTH_REQUIRED' ||
      (failure.code === null && status === ERROR_HTTP_STATUS.E_AUTH_REQUIRED);
  }
}

async function callFulfillment<T>(
  slug: (typeof ENDPOINT)[keyof typeof ENDPOINT],
  accessToken: string,
  body: object | FormData,
  options: { idempotencyKey?: string; signal?: AbortSignal },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const isMultipart = body instanceof FormData;
  if (!isMultipart) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey !== undefined) {
    headers[IDEMPOTENCY_KEY_HEADER] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(functionUrl(slug), {
      method: 'POST',
      headers,
      body: isMultipart ? body : JSON.stringify(body),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch {
    throw new FulfillmentApiError(NO_RESPONSE, null);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new FulfillmentApiError(NO_RESPONSE, response.status);
  }

  if (!response.ok) {
    const failure = readFailure(payload);
    if (
      failure.code === null &&
      response.status === ERROR_HTTP_STATUS.E_AUTH_REQUIRED
    ) {
      throw new FulfillmentApiError(
        { code: 'E_AUTH_REQUIRED', message: null, action: null },
        response.status,
      );
    }
    throw new FulfillmentApiError(failure, response.status);
  }

  return payload as T;
}

export function listParticipantPromises(
  accessToken: string,
  signal?: AbortSignal,
): Promise<ParticipantPromiseSummary[]> {
  return callFulfillment<ParticipantPromiseSummary[]>(
    ENDPOINT.participantPromiseList,
    accessToken,
    {},
    { ...(signal === undefined ? {} : { signal }) },
  );
}

export function getPromiseFulfillmentDetail(
  accessToken: string,
  promiseId: string,
  signal?: AbortSignal,
): Promise<PromiseFulfillmentDetailResponse> {
  const body: PromiseFulfillmentDetailRequest = { promise_id: promiseId };
  return callFulfillment<PromiseFulfillmentDetailResponse>(
    ENDPOINT.promiseFulfillmentDetail,
    accessToken,
    body,
    { ...(signal === undefined ? {} : { signal }) },
  );
}

export function submitFulfillment(
  accessToken: string,
  request: FulfillmentSubmitRequest,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<FulfillmentSubmitResponse> {
  return callFulfillment<FulfillmentSubmitResponse>(
    ENDPOINT.fulfillmentSubmit,
    accessToken,
    request,
    { idempotencyKey },
  );
}

export function reopenFulfillment(
  accessToken: string,
  request: FulfillmentReopenRequest,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<FulfillmentReopenResponse> {
  return callFulfillment<FulfillmentReopenResponse>(
    ENDPOINT.fulfillmentReopen,
    accessToken,
    request,
    { idempotencyKey },
  );
}

export function uploadFulfillmentEvidence(
  accessToken: string,
  promiseId: string,
  roundNo: number,
  file: File,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<EvidenceUploadResponse> {
  const body = new FormData();
  body.append('promise_id', promiseId);
  body.append('round_no', String(roundNo));
  body.append('file', file);
  return callFulfillment<EvidenceUploadResponse>(
    ENDPOINT.evidenceUpload,
    accessToken,
    body,
    { idempotencyKey },
  );
}

export function discardFulfillmentEvidence(
  accessToken: string,
  uploadId: string,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<{ upload_id: string; status: 'DISCARDED' }> {
  const body: EvidenceDiscardRequest = { upload_id: uploadId };
  return callFulfillment(
    ENDPOINT.evidenceDiscard,
    accessToken,
    body,
    { idempotencyKey },
  );
}

export function signFulfillmentEvidence(
  accessToken: string,
  evidenceId: string,
  variant: EvidenceSignUrlRequest['variant'],
): Promise<EvidenceSignUrlResponse> {
  const body: EvidenceSignUrlRequest = {
    evidence_id: evidenceId,
    variant,
  };
  return callFulfillment(
    ENDPOINT.evidenceSignUrl,
    accessToken,
    body,
    {},
  );
}
