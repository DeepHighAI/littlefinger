import { asCompletionCelebrationClaimResponse } from '../../../packages/shared/src/completion-celebration.ts';
import { completionCelebrationPromiseIdOf } from '../_shared/completion-celebration.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createCompletionCelebrationClaimHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const promiseId = completionCelebrationPromiseIdOf(
        await jsonBody(request, 'promise_id'),
      );
      const payload = asCompletionCelebrationClaimResponse(
        await deps.rpc('lf_completion_celebration_claim', {
          p_idempotency_key: idempotencyKey,
          p_actor: actor,
          p_promise_id: promiseId,
        }),
      );
      if (payload === null) throw new Error('INVALID_COMPLETION_CELEBRATION_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
