import {
  ENDPOINT,
  asPromiseDetailResponse,
  type Endpoint,
  type PromiseDetailResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface PromiseDetailApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function getPromiseDetail(
  promiseId: string,
  deps: PromiseDetailApiDeps,
): Promise<PromiseDetailResponse> {
  const raw = await deps.call<unknown>(ENDPOINT.promiseDetail, { promise_id: promiseId }, {
    idempotent: false,
  });
  const parsed = asPromiseDetailResponse(raw);
  if (parsed === null) throw new Error('INVALID_PROMISE_DETAIL_RESPONSE');
  return parsed;
}
