import { asProfileNicknameUpdateResponse } from '../../../packages/shared/src/account-safety.ts';
import { nicknameOf } from '../_shared/account-safety.ts';
import type { Deps } from '../_shared/deps.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createProfileNicknameUpdateHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const nickname = nicknameOf(await jsonBody(request, 'nickname'));
      const payload = asProfileNicknameUpdateResponse(await deps.rpc('lf_profile_nickname_update', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_nickname: nickname,
      }));
      if (payload === null) throw new Error('INVALID_PROFILE_NICKNAME_UPDATE_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { validation: { field: 'nickname', message: null }, log: deps.log.error });
    }
  };
}
