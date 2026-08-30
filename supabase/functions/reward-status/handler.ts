import { asRewardStatusResponse } from '../../../packages/shared/src/monetization.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { uuidField } from '../_shared/monetization.ts';
import { jsonBody } from '../_shared/request.ts';

export function createRewardStatusHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'intent_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const intentId = uuidField(await jsonBody(request, 'intent_id'), 'intent_id');
      const payload = asRewardStatusResponse(await deps.rpc('lf_reward_status', {
        p_actor: actor,
        p_intent_id: intentId,
      }));
      if (payload === null) throw new Error('INVALID_REWARD_STATUS_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
