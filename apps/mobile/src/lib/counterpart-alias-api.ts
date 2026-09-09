import {
  ENDPOINT,
  asCounterpartAliasResponse,
  type CounterpartAliasResponse,
} from '@littlefinger/shared';

import type { AccountSafetyApiDeps } from './account-safety-api.ts';
import { MobileApiError } from './mobile-api.ts';

function requireAlias(value: unknown): CounterpartAliasResponse {
  const parsed = asCounterpartAliasResponse(value);
  if (parsed === null) throw new MobileApiError(null, 'INVALID_COUNTERPART_ALIAS_RESPONSE');
  return parsed;
}

export async function fetchCounterpartAlias(
  promiseId: string,
  deps: AccountSafetyApiDeps,
): Promise<CounterpartAliasResponse> {
  return requireAlias(await deps.call(ENDPOINT.counterpartAliasGet, { promise_id: promiseId }, { idempotent: false }));
}

export async function updateCounterpartAlias(
  promiseId: string,
  alias: string | null,
  idempotencyKey: string,
  deps: AccountSafetyApiDeps,
): Promise<CounterpartAliasResponse> {
  return requireAlias(await deps.call(
    ENDPOINT.counterpartAliasUpdate,
    { promise_id: promiseId, alias },
    { idempotent: true, idempotencyKey },
  ));
}
