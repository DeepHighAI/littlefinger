import { asWitnessJoinResponse } from '../../../packages/shared/src/witness.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { inviteTokenHash } from '../_shared/hash.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';
import { witnessTokenOf } from '../_shared/witness.ts';

export function createWitnessJoinHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'token' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const token = witnessTokenOf(await jsonBody(request));
      const payload = asWitnessJoinResponse(await deps.rpc('lf_witness_join', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_token_hash: await inviteTokenHash(token, deps.secrets.invitePepper),
      }));
      if (payload === null) throw new Error('INVALID_WITNESS_JOIN_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
