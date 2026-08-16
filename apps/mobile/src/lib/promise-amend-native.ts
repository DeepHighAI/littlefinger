import type {
  PromiseAmendCreateRequest,
  PromiseAmendCreateResponse,
  PromiseAmendRespondRequest,
  PromiseAmendRespondResponse,
  PromiseAmendWithdrawResponse,
  PromiseVersionListResponse,
} from '@littlefinger/shared';
import * as Crypto from 'expo-crypto';

import { callMobileFunctionNative } from './mobile-api-native.ts';
import {
  listPromiseVersions as listPromiseVersionsWith,
  requestPromiseAmend as requestPromiseAmendWith,
  respondPromiseAmend as respondPromiseAmendWith,
  withdrawPromiseAmend as withdrawPromiseAmendWith,
} from './promise-amend-api.ts';

const deps = { call: callMobileFunctionNative };

export function createPromiseAmendIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export async function requestPromiseAmend(
  input: PromiseAmendCreateRequest,
  idempotencyKey: string,
): Promise<PromiseAmendCreateResponse> {
  return await requestPromiseAmendWith(input, idempotencyKey, deps);
}

export async function respondPromiseAmend(
  input: PromiseAmendRespondRequest,
  idempotencyKey: string,
): Promise<PromiseAmendRespondResponse> {
  return await respondPromiseAmendWith(input, idempotencyKey, deps);
}

export async function withdrawPromiseAmend(
  promiseId: string,
  requestId: string,
  idempotencyKey: string,
): Promise<PromiseAmendWithdrawResponse> {
  return await withdrawPromiseAmendWith(promiseId, requestId, idempotencyKey, deps);
}

export async function listPromiseVersions(promiseId: string): Promise<PromiseVersionListResponse> {
  return await listPromiseVersionsWith(promiseId, deps);
}
