import { asCounterpartAliasResponse } from '../../../packages/shared/src/account-safety.ts';
import { counterpartAliasPromiseOf } from '../_shared/account-safety.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody } from '../_shared/request.ts';

export function createCounterpartAliasGetHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const promiseId = counterpartAliasPromiseOf(await jsonBody(request, 'promise_id'));
      const payload = asCounterpartAliasResponse(await deps.rpc('lf_counterpart_alias_get', {
        p_actor: actor, p_promise_id: promiseId,
      }));
      if (payload === null) throw new Error('INVALID_COUNTERPART_ALIAS_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { validation: { field: 'promise_id', message: null }, log: deps.log.error });
    }
  };
}
