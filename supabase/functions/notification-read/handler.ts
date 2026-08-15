import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { asNotificationReadResponse } from '../_shared/notification-inbox.ts';
import { idempotencyKeyOf, jsonBody, requiredString } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createNotificationReadHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'notification_id' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      idempotencyKeyOf(request);
      const body = await jsonBody(request, 'notification_id');
      const notificationId = requiredString(body, 'notification_id', 'notification_id');
      if (!UUID_PATTERN.test(notificationId)) {
        throw new ApiError('E_VALIDATION', { field: 'notification_id' });
      }
      const payload = asNotificationReadResponse(
        await deps.rpc('lf_notification_read', { p_actor: actor, p_notification_id: notificationId }),
      );
      if (payload === null) throw new Error('INVALID_NOTIFICATION_READ_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
