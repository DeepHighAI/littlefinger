import { asUserUnblockResponse } from '../../../packages/shared/src/account-safety.ts';
import { blockTargetOf } from '../_shared/account-safety.ts';
import type { Deps } from '../_shared/deps.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createUserUnblockHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const targetUserId = blockTargetOf(await jsonBody(request, 'target_user_id'));
      const payload = asUserUnblockResponse(await deps.rpc('lf_user_unblock', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_target_user_id: targetUserId,
      }));
      if (payload === null) throw new Error('INVALID_USER_UNBLOCK_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { validation: { field: 'target_user_id', message: null }, log: deps.log.error });
    }
  };
}
