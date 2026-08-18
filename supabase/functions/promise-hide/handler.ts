import { asPromiseHideResponse } from '../../../packages/shared/src/account-safety.ts';
import { promiseHideOf } from '../_shared/account-safety.ts';
import type { Deps } from '../_shared/deps.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createPromiseHideHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const input = promiseHideOf(await jsonBody(request, 'promise_id'));
      const payload = asPromiseHideResponse(await deps.rpc('lf_promise_hide', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_promise_id: input.promiseId,
        p_hidden: input.hidden,
      }));
      if (payload === null) throw new Error('INVALID_PROMISE_HIDE_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { validation: { field: 'promise_id', message: null }, log: deps.log.error });
    }
  };
}
