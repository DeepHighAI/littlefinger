// promise-pending-delete — PO 2026-08-31. 작성자의 PENDING 약속과 모든 초대 경로를 지운다.

import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody, requiredString } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPromisePendingDeleteHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const userId = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const body = await jsonBody(request, 'promise_id');
      const promiseId = requiredString(body, 'promise_id', 'promise_id');
      if (!UUID_PATTERN.test(promiseId)) {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const payload = await deps.rpc('lf_promise_pending_delete', {
        p_idempotency_key: idempotencyKey,
        p_user_id: userId,
        p_promise_id: promiseId,
      });
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
