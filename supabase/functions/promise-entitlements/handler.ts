import { asPromiseEntitlementsView } from '../../../packages/shared/src/monetization.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { uuidField } from '../_shared/monetization.ts';
import { jsonBody } from '../_shared/request.ts';

export function createPromiseEntitlementsHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const promiseId = uuidField(await jsonBody(request, 'promise_id'), 'promise_id');
      const payload = asPromiseEntitlementsView(await deps.rpc('lf_promise_entitlements', {
        p_actor: actor,
        p_promise_id: promiseId,
      }));
      if (payload === null) throw new Error('INVALID_PROMISE_ENTITLEMENTS_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
