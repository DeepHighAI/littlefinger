import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { asNotificationReadAllResponse } from '../_shared/notification-inbox.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createNotificationReadAllHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'idempotency_key' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      idempotencyKeyOf(request);
      const body = await jsonBody(request, 'idempotency_key');
      if (Object.keys(body).length > 0) throw new ApiError('E_VALIDATION', { field: 'idempotency_key' });
      const payload = asNotificationReadAllResponse(
        await deps.rpc('lf_notification_read_all', { p_actor: actor }),
      );
      if (payload === null) throw new Error('INVALID_NOTIFICATION_READ_ALL_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
