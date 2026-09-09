import { asCounterpartAliasResponse } from '../../../packages/shared/src/account-safety.ts';
import { counterpartAliasUpdateOf } from '../_shared/account-safety.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createCounterpartAliasUpdateHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'nickname' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const key = idempotencyKeyOf(request);
      const input = counterpartAliasUpdateOf(await jsonBody(request, 'nickname'));
      const payload = asCounterpartAliasResponse(await deps.rpc('lf_counterpart_alias_update', {
        p_idempotency_key: key, p_actor: actor, p_promise_id: input.promiseId, p_alias: input.alias,
      }));
      if (payload === null) throw new Error('INVALID_COUNTERPART_ALIAS_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { validation: { field: 'nickname', message: null }, log: deps.log.error });
    }
  };
}
