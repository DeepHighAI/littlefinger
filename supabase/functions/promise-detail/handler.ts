import { asPromiseDetailResponse } from '../../../packages/shared/src/promise-detail.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { promiseDetailRequestOf } from '../_shared/promise-detail.ts';
import { jsonBody } from '../_shared/request.ts';

export function createPromiseDetailHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const input = promiseDetailRequestOf(await jsonBody(request, 'promise_id'));
      const payload = asPromiseDetailResponse(
        await deps.rpc('lf_promise_detail', {
          p_actor: actor,
          p_promise_id: input.promise_id,
        }),
      );
      if (payload === null) throw new Error('INVALID_PROMISE_DETAIL_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
