import { asWitnessDetailResponse } from '../../../packages/shared/src/witness.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { inviteTokenHash } from '../_shared/hash.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody } from '../_shared/request.ts';
import { witnessTokenOf } from '../_shared/witness.ts';

export function createWitnessPreviewHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'token' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const token = witnessTokenOf(await jsonBody(request));
      const payload = asWitnessDetailResponse(await deps.rpc('lf_witness_preview', {
        p_actor: actor,
        p_token_hash: await inviteTokenHash(token, deps.secrets.invitePepper),
      }));
      if (payload === null) throw new Error('INVALID_WITNESS_PREVIEW_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
