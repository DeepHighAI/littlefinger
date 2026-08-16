import {
  ENDPOINT,
  ERROR_HTTP_STATUS,
  IDEMPOTENCY_KEY_HEADER,
  asPromiseAmendCreateResponse,
  asPromiseAmendRespondResponse,
  asPromiseAmendWithdrawResponse,
  asPromiseDetailResponse,
  asPromiseVersionListResponse,
  type Endpoint,
  type PromiseAmendCreateRequest,
  type PromiseAmendCreateResponse,
  type PromiseAmendRespondRequest,
  type PromiseAmendRespondResponse,
  type PromiseAmendWithdrawResponse,
  type PromiseDetailResponse,
  type PromiseVersionListResponse,
} from '@littlefinger/shared';

import { messageForFailure, NO_RESPONSE, readFailure, type ApiFailure } from './api-failure.ts';
import { functionUrl } from './supabase.ts';

export class PromiseAmendApiError extends Error {
  readonly authExpired: boolean;

  constructor(readonly failure: ApiFailure, readonly status: number | null) {
    super(messageForFailure(failure));
    this.name = 'PromiseAmendApiError';
    this.authExpired = failure.code === 'E_AUTH_REQUIRED'
      || (failure.code === null && status === ERROR_HTTP_STATUS.E_AUTH_REQUIRED);
  }
}

async function callAmend<T>(
  endpoint: Endpoint,
  accessToken: string,
  body: object,
  parse: (value: unknown) => T | null,
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
    response = await fetch(functionUrl(endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch {
    throw new PromiseAmendApiError(NO_RESPONSE, null);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PromiseAmendApiError(NO_RESPONSE, response.status);
  }
  if (!response.ok) {
    const failure = readFailure(payload);
    if (failure.code === null && response.status === ERROR_HTTP_STATUS.E_AUTH_REQUIRED) {
      throw new PromiseAmendApiError(
        { code: 'E_AUTH_REQUIRED', message: null, action: null },
        response.status,
      );
    }
    throw new PromiseAmendApiError(failure, response.status);
  }

  const parsed = parse(payload);
  if (parsed === null) throw new PromiseAmendApiError(NO_RESPONSE, response.status);
  return parsed;
}

export function requestPromiseAmend(
  accessToken: string,
  input: PromiseAmendCreateRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<PromiseAmendCreateResponse> {
  return callAmend(
    ENDPOINT.promiseAmendRequest,
    accessToken,
    input,
    asPromiseAmendCreateResponse,
    { idempotencyKey, ...(signal === undefined ? {} : { signal }) },
  );
}

export function respondPromiseAmend(
  accessToken: string,
  input: PromiseAmendRespondRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<PromiseAmendRespondResponse> {
  return callAmend(
    ENDPOINT.promiseAmendRespond,
    accessToken,
    input,
    asPromiseAmendRespondResponse,
    { idempotencyKey, ...(signal === undefined ? {} : { signal }) },
  );
}

export function withdrawPromiseAmend(
  accessToken: string,
  promiseId: string,
  requestId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<PromiseAmendWithdrawResponse> {
  return callAmend(
    ENDPOINT.promiseAmendWithdraw,
    accessToken,
    { promise_id: promiseId, request_id: requestId },
    asPromiseAmendWithdrawResponse,
    { idempotencyKey, ...(signal === undefined ? {} : { signal }) },
  );
}

export function listPromiseVersions(
  accessToken: string,
  promiseId: string,
  signal?: AbortSignal,
): Promise<PromiseVersionListResponse> {
  return callAmend(
    ENDPOINT.promiseVersionList,
    accessToken,
    { promise_id: promiseId },
    asPromiseVersionListResponse,
    signal === undefined ? {} : { signal },
  );
}

export function getPromiseAmendDetail(
  accessToken: string,
  promiseId: string,
  signal?: AbortSignal,
): Promise<PromiseDetailResponse> {
  return callAmend(
    ENDPOINT.promiseDetail,
    accessToken,
    { promise_id: promiseId },
    asPromiseDetailResponse,
    signal === undefined ? {} : { signal },
  );
}
