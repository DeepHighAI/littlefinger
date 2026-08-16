import { asPromiseAmendCreateResponse } from '../../../packages/shared/src/promise-amend.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import {
  amendAuditArgs,
  promiseAmendCreateRequestOf,
} from '../_shared/promise-amend.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createPromiseAmendRequestHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const input = promiseAmendCreateRequestOf(await jsonBody(request, 'promise_id'), deps.now());
      const payload = asPromiseAmendCreateResponse(await deps.rpc('lf_promise_amend_request', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_promise_id: input.promise_id,
        p_type: input.type,
        p_proposed: input.proposed,
        p_reason: input.reason,
        ...await amendAuditArgs(request, deps),
      }));
      if (payload === null) throw new Error('INVALID_PROMISE_AMEND_CREATE_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, {
        validation: { field: 'proposed', message: null },
        log: deps.log.error,
      });
    }
  };
}
