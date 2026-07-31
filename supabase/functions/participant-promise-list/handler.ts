import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';

export function createParticipantPromiseListHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const payload = await deps.rpc('lf_participant_promise_list', { p_actor: actor });
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
