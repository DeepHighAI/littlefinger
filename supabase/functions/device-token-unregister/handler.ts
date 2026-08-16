import { asDeviceTokenUnregisterResponse } from '../../../packages/shared/src/trust-profile.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';
import { expoPushTokenOf } from '../_shared/trust-profile.ts';

export function createDeviceTokenUnregisterHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'expo_push_token' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const expoPushToken = expoPushTokenOf(await jsonBody(request, 'expo_push_token'));
      const payload = asDeviceTokenUnregisterResponse(
        await deps.rpc('lf_device_token_unregister', {
          p_actor: actor,
          p_idempotency_key: idempotencyKey,
          p_expo_push_token: expoPushToken,
        }),
      );
      if (payload === null) throw new Error('INVALID_DEVICE_TOKEN_UNREGISTER_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, {
        validation: { field: 'expo_push_token', message: null },
        log: deps.log.error,
      });
    }
  };
}
