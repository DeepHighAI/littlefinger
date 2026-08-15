import { asPromiseHomeListResponse } from '../../../packages/shared/src/promise-home.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { promiseHomeListRequestOf } from '../_shared/promise-home.ts';
import { jsonBody } from '../_shared/request.ts';

export function createPromiseHomeListHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'tab' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const input = promiseHomeListRequestOf(await jsonBody(request, 'tab'));
      const payload = asPromiseHomeListResponse(
        await deps.rpc('lf_promise_home_list', {
          p_actor: actor,
          p_tab: input.tab,
          p_cursor: input.cursor,
        }),
        input.tab,
      );
      if (payload === null) throw new Error('INVALID_PROMISE_HOME_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
