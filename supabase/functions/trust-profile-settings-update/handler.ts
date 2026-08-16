import { asTrustProfileSettingsUpdateResponse } from '../../../packages/shared/src/trust-profile.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';
import { reminderPreferencesOf } from '../_shared/trust-profile.ts';

export function createTrustProfileSettingsUpdateHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'reminders' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const reminders = reminderPreferencesOf(await jsonBody(request, 'reminders'));
      const payload = asTrustProfileSettingsUpdateResponse(
        await deps.rpc('lf_trust_profile_settings_update', {
          p_actor: actor,
          p_idempotency_key: idempotencyKey,
          p_reminders: reminders,
        }),
      );
      if (payload === null) throw new Error('INVALID_TRUST_PROFILE_SETTINGS_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, {
        validation: { field: 'reminders', message: null },
        log: deps.log.error,
      });
    }
  };
}
