import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody, requiredString } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPromiseFulfillmentDetailHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'promise_id');
      const promiseId = requiredString(body, 'promise_id', 'promise_id');
      if (!UUID_PATTERN.test(promiseId)) {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const payload = await deps.rpc('lf_promise_fulfillment_detail', {
        p_actor: actor,
        p_promise_id: promiseId,
      });
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
