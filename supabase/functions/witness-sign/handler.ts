import { asWitnessSignResponse } from '../../../packages/shared/src/witness.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { piiHash } from '../_shared/hash.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import {
  clientIp,
  idempotencyKeyOf,
  jsonBody,
  surfaceOf,
  userAgent,
} from '../_shared/request.ts';
import { witnessPromiseIdOf } from '../_shared/witness.ts';

export function createWitnessSignHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const promiseId = witnessPromiseIdOf(await jsonBody(request, 'promise_id'));
      const ip = clientIp(request);
      const ua = userAgent(request);
      const payload = asWitnessSignResponse(await deps.rpc('lf_witness_sign', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_promise_id: promiseId,
        p_surface: surfaceOf(request),
        p_ip_hash: ip === null ? null : await piiHash(ip, deps.secrets.piiSalt),
        p_user_agent_hash: ua === null ? null : await piiHash(ua, deps.secrets.piiSalt),
      }));
      if (payload === null) throw new Error('INVALID_WITNESS_SIGN_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
