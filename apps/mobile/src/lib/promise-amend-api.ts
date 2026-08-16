import {
  ENDPOINT,
  asPromiseAmendCreateResponse,
  asPromiseAmendRespondResponse,
  asPromiseAmendWithdrawResponse,
  asPromiseVersionListResponse,
  type Endpoint,
  type PromiseAmendCreateRequest,
  type PromiseAmendCreateResponse,
  type PromiseAmendRespondRequest,
  type PromiseAmendRespondResponse,
  type PromiseAmendWithdrawResponse,
  type PromiseVersionListResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface PromiseAmendApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

async function mutation<T>(
  endpoint: Endpoint,
  body: unknown,
  idempotencyKey: string,
  parse: (value: unknown) => T | null,
  invalid: string,
  deps: PromiseAmendApiDeps,
): Promise<T> {
  const parsed = parse(await deps.call<unknown>(endpoint, body, {
    idempotent: true,
    idempotencyKey,
  }));
  if (parsed === null) throw new Error(invalid);
  return parsed;
}

export async function requestPromiseAmend(
  input: PromiseAmendCreateRequest,
  idempotencyKey: string,
  deps: PromiseAmendApiDeps,
): Promise<PromiseAmendCreateResponse> {
  return await mutation(
    ENDPOINT.promiseAmendRequest,
    input,
    idempotencyKey,
    asPromiseAmendCreateResponse,
    'INVALID_PROMISE_AMEND_CREATE_RESPONSE',
    deps,
  );
}

export async function respondPromiseAmend(
  input: PromiseAmendRespondRequest,
  idempotencyKey: string,
  deps: PromiseAmendApiDeps,
): Promise<PromiseAmendRespondResponse> {
  return await mutation(
    ENDPOINT.promiseAmendRespond,
    input,
    idempotencyKey,
    asPromiseAmendRespondResponse,
    'INVALID_PROMISE_AMEND_RESPOND_RESPONSE',
    deps,
  );
}

export async function withdrawPromiseAmend(
  promiseId: string,
  requestId: string,
  idempotencyKey: string,
  deps: PromiseAmendApiDeps,
): Promise<PromiseAmendWithdrawResponse> {
  return await mutation(
    ENDPOINT.promiseAmendWithdraw,
    { promise_id: promiseId, request_id: requestId },
    idempotencyKey,
    asPromiseAmendWithdrawResponse,
    'INVALID_PROMISE_AMEND_WITHDRAW_RESPONSE',
    deps,
  );
}

export async function listPromiseVersions(
  promiseId: string,
  deps: PromiseAmendApiDeps,
): Promise<PromiseVersionListResponse> {
  const parsed = asPromiseVersionListResponse(await deps.call<unknown>(
    ENDPOINT.promiseVersionList,
    { promise_id: promiseId },
    { idempotent: false },
  ));
  if (parsed === null) throw new Error('INVALID_PROMISE_VERSION_LIST_RESPONSE');
  return parsed;
}
