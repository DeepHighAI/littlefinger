import { asPromiseAmendWithdrawResponse } from '../../../packages/shared/src/promise-amend.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { amendAuditArgs, promiseAmendWithdrawRequestOf } from '../_shared/promise-amend.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createPromiseAmendWithdrawHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const input = promiseAmendWithdrawRequestOf(await jsonBody(request, 'promise_id'));
      const payload = asPromiseAmendWithdrawResponse(await deps.rpc('lf_promise_amend_withdraw', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_promise_id: input.promise_id,
        p_request_id: input.request_id,
        ...await amendAuditArgs(request, deps),
      }));
      if (payload === null) throw new Error('INVALID_PROMISE_AMEND_WITHDRAW_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
