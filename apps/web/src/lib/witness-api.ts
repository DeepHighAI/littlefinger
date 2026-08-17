import {
  ENDPOINT,
  ERROR_HTTP_STATUS,
  IDEMPOTENCY_KEY_HEADER,
  asWitnessDetailResponse,
  asWitnessJoinResponse,
  asWitnessLeaveResponse,
  asWitnessSignResponse,
  type Endpoint,
  type WitnessDetailResponse,
  type WitnessJoinResponse,
  type WitnessLeaveResponse,
  type WitnessSignResponse,
} from '@littlefinger/shared';

import {
  messageForFailure,
  NO_RESPONSE,
  readFailure,
  type ApiFailure,
} from './api-failure.ts';
import { functionUrl } from './supabase.ts';

export class WitnessApiError extends Error {
  readonly authExpired: boolean;

  constructor(
    readonly failure: ApiFailure,
    readonly status: number | null,
  ) {
    super(messageForFailure(failure));
    this.name = 'WitnessApiError';
    this.authExpired =
      failure.code === 'E_AUTH_REQUIRED'
      || (failure.code === null && status === ERROR_HTTP_STATUS.E_AUTH_REQUIRED);
  }
}

async function callWitness<T>(
  slug: Endpoint,
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
    response = await fetch(functionUrl(slug), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch {
    throw new WitnessApiError(NO_RESPONSE, null);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new WitnessApiError(NO_RESPONSE, response.status);
  }

  if (!response.ok) {
    const failure = readFailure(payload);
    if (failure.code === null && response.status === ERROR_HTTP_STATUS.E_AUTH_REQUIRED) {
      throw new WitnessApiError(
        { code: 'E_AUTH_REQUIRED', message: null, action: null },
        response.status,
      );
    }
    throw new WitnessApiError(failure, response.status);
  }

  const parsed = parse(payload);
  if (parsed === null) throw new WitnessApiError(NO_RESPONSE, response.status);
  return parsed;
}

export function joinWitness(
  accessToken: string,
  token: string,
  idempotencyKey: string = crypto.randomUUID(),
  signal?: AbortSignal,
): Promise<WitnessJoinResponse> {
  return callWitness(
    ENDPOINT.witnessJoin,
    accessToken,
    { token },
    asWitnessJoinResponse,
    { idempotencyKey, ...(signal === undefined ? {} : { signal }) },
  );
}

export function getWitnessDetail(
  accessToken: string,
  promiseId: string,
  signal?: AbortSignal,
): Promise<WitnessDetailResponse> {
  return callWitness(
    ENDPOINT.witnessDetail,
    accessToken,
    { promise_id: promiseId },
    asWitnessDetailResponse,
    { ...(signal === undefined ? {} : { signal }) },
  );
}

export function signWitness(
  accessToken: string,
  promiseId: string,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<WitnessSignResponse> {
  return callWitness(
    ENDPOINT.witnessSign,
    accessToken,
    { promise_id: promiseId },
    asWitnessSignResponse,
    { idempotencyKey },
  );
}

export function leaveWitness(
  accessToken: string,
  promiseId: string,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<WitnessLeaveResponse> {
  return callWitness(
    ENDPOINT.witnessLeave,
    accessToken,
    { promise_id: promiseId },
    asWitnessLeaveResponse,
    { idempotencyKey },
  );
}
