import { asWitnessInviteResponse } from '../../../packages/shared/src/witness.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { attachToken, issueToken } from '../_shared/invite.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';
import { witnessInviteInputOf } from '../_shared/witness.ts';

export function createWitnessInviteHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const input = witnessInviteInputOf(await jsonBody(request, 'promise_id'));
      const issued = await issueToken(deps.secrets.invitePepper);
      const attached = attachToken(await deps.rpc('lf_witness_invite', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_promise_id: input.promiseId,
        p_token_hash: issued.hash,
        p_participant_id: input.participantId,
      }), issued);
      const payload = asWitnessInviteResponse(attached);
      if (payload === null) throw new Error('INVALID_WITNESS_INVITE_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
