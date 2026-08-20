import { asUserBlockListResponse } from '../../../packages/shared/src/account-safety.ts';
import { emptyBlockListBody } from '../_shared/account-safety.ts';
import type { Deps } from '../_shared/deps.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody } from '../_shared/request.ts';

export function createUserBlockListHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      const actor = await deps.authenticate(request.headers.get('authorization'));
      emptyBlockListBody(await jsonBody(request, 'target_user_id'));
      const payload = asUserBlockListResponse(
        await deps.rpc('lf_user_block_list', { p_actor: actor }),
      );
      if (payload === null) throw new Error('INVALID_USER_BLOCK_LIST_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
