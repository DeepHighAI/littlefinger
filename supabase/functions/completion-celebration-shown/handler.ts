import { asCompletionCelebrationShownResponse } from '../../../packages/shared/src/completion-celebration.ts';
import { completionCelebrationShownInputOf } from '../_shared/completion-celebration.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createCompletionCelebrationShownHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const input = completionCelebrationShownInputOf(
        await jsonBody(request, 'promise_id'),
      );
      const payload = asCompletionCelebrationShownResponse(
        await deps.rpc('lf_completion_celebration_shown', {
          p_idempotency_key: idempotencyKey,
          p_actor: actor,
          p_promise_id: input.promiseId,
          p_claim_id: input.claimId,
        }),
      );
      if (payload === null) {
        throw new Error('INVALID_COMPLETION_CELEBRATION_SHOWN_RESPONSE');
      }
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
