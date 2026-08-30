import { asRewardIntentResponse } from '../../../packages/shared/src/monetization.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { rewardActionOf, uuidField } from '../_shared/monetization.ts';
import { jsonBody } from '../_shared/request.ts';

export function createRewardIntentHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'action' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'action');
      const payload = asRewardIntentResponse(await deps.rpc('lf_reward_intent_create', {
        p_actor: actor,
        p_promise_id: uuidField(body, 'promise_id'),
        p_action: rewardActionOf(body),
      }));
      if (payload === null) throw new Error('INVALID_REWARD_INTENT_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
