import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { asNotificationInboxListResponse } from '../_shared/notification-inbox.ts';
import { jsonBody } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cursorArgs(body: Record<string, unknown>): {
  p_cursor_created_at: string | null;
  p_cursor_notification_id: string | null;
  p_limit: number | null;
} {
  const cursor = body['cursor'];
  if (cursor !== undefined) {
    if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) {
      throw new ApiError('E_VALIDATION', { field: 'cursor' });
    }
    const value = cursor as Record<string, unknown>;
    if (
      typeof value['created_at'] !== 'string' ||
      !Number.isFinite(Date.parse(value['created_at'])) ||
      typeof value['notification_id'] !== 'string' ||
      !UUID_PATTERN.test(value['notification_id'])
    ) {
      throw new ApiError('E_VALIDATION', { field: 'cursor' });
    }
    return {
      p_cursor_created_at: value['created_at'],
      p_cursor_notification_id: value['notification_id'],
      p_limit: limitOf(body),
    };
  }
  return {
    p_cursor_created_at: null,
    p_cursor_notification_id: null,
    p_limit: limitOf(body),
  };
}

function limitOf(body: Record<string, unknown>): number | null {
  const limit = body['limit'];
  if (limit === undefined) return null;
  if (!Number.isInteger(limit)) throw new ApiError('E_VALIDATION', { field: 'limit' });
  return limit as number;
}

export function createNotificationInboxHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'cursor' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'cursor');
      const payload = asNotificationInboxListResponse(
        await deps.rpc('lf_notification_inbox_list', { p_actor: actor, ...cursorArgs(body) }),
      );
      if (payload === null) throw new Error('INVALID_NOTIFICATION_INBOX_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
