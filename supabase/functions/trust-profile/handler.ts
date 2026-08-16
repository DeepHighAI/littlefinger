import { asTrustProfileDetailResponse } from '../../../packages/shared/src/trust-profile.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody } from '../_shared/request.ts';
import { assertEmptyTrustProfileBody } from '../_shared/trust-profile.ts';

export function createTrustProfileHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'reminders' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'reminders');
      assertEmptyTrustProfileBody(body);
      const payload = asTrustProfileDetailResponse(
        await deps.rpc('lf_my_trust_profile', { p_actor: actor }),
      );
      if (payload === null) throw new Error('INVALID_TRUST_PROFILE_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
