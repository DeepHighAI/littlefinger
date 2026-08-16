import { asPromiseVersionListResponse } from '../../../packages/shared/src/promise-amend.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { promiseVersionListRequestOf } from '../_shared/promise-amend.ts';
import { jsonBody } from '../_shared/request.ts';

export function createPromiseVersionListHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      if (request.headers.has('idempotency-key')) {
        throw new ApiError('E_VALIDATION', { field: 'idempotency_key' });
      }
      const input = promiseVersionListRequestOf(await jsonBody(request, 'promise_id'));
      const payload = asPromiseVersionListResponse(await deps.rpc('lf_promise_version_list', {
        p_actor: actor,
        p_promise_id: input.promise_id,
      }));
      if (payload === null) throw new Error('INVALID_PROMISE_VERSION_LIST_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
