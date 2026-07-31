import {
  ENDPOINT,
  ERROR_HTTP_STATUS,
  IDEMPOTENCY_KEY_HEADER,
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
  body: object,
  options: { idempotencyKey?: string; signal?: AbortSignal },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (options.idempotencyKey !== undefined) {
    headers[IDEMPOTENCY_KEY_HEADER] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(functionUrl(slug), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
