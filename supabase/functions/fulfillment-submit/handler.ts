import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { notifyFulfillmentSubmit } from '../_shared/fulfillment.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody, requiredString, surfaceOf } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createFulfillmentSubmitHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const body = await jsonBody(request, 'promise_id');
      const promiseId = requiredString(body, 'promise_id', 'promise_id');
      if (!UUID_PATTERN.test(promiseId)) {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const answer = body['answer'];
      if (answer !== 'KEPT' && answer !== 'NOT_KEPT') {
        throw new ApiError('E_VALIDATION', { field: 'answer' });
      }
      const comment = body['comment'];
      if (comment !== undefined && typeof comment !== 'string') {
        throw new ApiError('E_VALIDATION', { field: 'comment' });
      }
      const revise = body['revise'];
      if (revise !== undefined && typeof revise !== 'boolean') {
        throw new ApiError('E_VALIDATION', { field: 'revise' });
      }

      const payload = await deps.rpc('lf_fulfillment_submit', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_promise_id: promiseId,
        p_answer: answer,
        p_comment: comment ?? null,
        p_revise: revise ?? false,
        p_surface: surfaceOf(request),
      });
      try {
        await notifyFulfillmentSubmit(payload, actor, idempotencyKey, deps);
      } catch (notificationFailure) {
        deps.log.error('notification fanout failed', {
          endpoint: 'fulfillment-submit',
          raised: String(notificationFailure),
        });
      }
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, {
        validation: { field: 'comment', message: null },
        log: deps.log.error,
      });
    }
  };
}
