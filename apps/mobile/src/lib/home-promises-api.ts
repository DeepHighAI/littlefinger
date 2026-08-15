import {
  ENDPOINT,
  asPromiseHomeListResponse,
  type Endpoint,
  type PromiseHomeListRequest,
  type PromiseHomeListResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface HomePromisesApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function listHomePromises(
  input: PromiseHomeListRequest,
  deps: HomePromisesApiDeps,
): Promise<PromiseHomeListResponse> {
  const raw = await deps.call<unknown>(ENDPOINT.promiseHomeList, input, {
    idempotent: false,
  });
  const parsed = asPromiseHomeListResponse(raw, input.tab);
  if (parsed === null) throw new Error('INVALID_PROMISE_HOME_RESPONSE');
  return parsed;
}
