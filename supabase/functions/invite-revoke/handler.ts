// invite-revoke — 02 §4-3-2. 현재 PARTNER 초대만 닫고 약속은 PENDING으로 유지한다.

import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody, requiredString } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createInviteRevokeHandler(deps: Deps) {
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

      // UUID 캐스팅 오류의 Postgres 타입 이름을 실패 응답에 노출하지 않는다.
      if (!UUID_PATTERN.test(promiseId)) {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const payload = await deps.rpc('lf_invite_revoke', {
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
