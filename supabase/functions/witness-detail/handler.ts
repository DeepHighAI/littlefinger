import { asWitnessDetailResponse } from '../../../packages/shared/src/witness.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody } from '../_shared/request.ts';
import { witnessPromiseIdOf } from '../_shared/witness.ts';

export function createWitnessDetailHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const promiseId = witnessPromiseIdOf(await jsonBody(request, 'promise_id'));
      const payload = asWitnessDetailResponse(await deps.rpc('lf_witness_detail', {
        p_actor: actor,
        p_promise_id: promiseId,
      }));
      if (payload === null) throw new Error('INVALID_WITNESS_DETAIL_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
