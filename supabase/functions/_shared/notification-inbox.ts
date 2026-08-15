import type {
  NotificationInboxCursor,
  NotificationInboxListResponse,
  NotificationReadAllResponse,
  NotificationReadResponse,
} from '../../../packages/shared/src/api.ts';
import { isIsoInstant } from '../../../packages/shared/src/datetime.ts';
import { asNotificationInboxItem } from '../../../packages/shared/src/notification.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asCursor(value: unknown): NotificationInboxCursor | null {
  if (typeof value !== 'object' || value === null) return null;
  const cursor = value as Record<string, unknown>;
  if (
    !isIsoInstant(cursor['created_at']) ||
    typeof cursor['notification_id'] !== 'string' ||
    !UUID_PATTERN.test(cursor['notification_id'])
  ) {
    return null;
  }
  return {
    created_at: cursor['created_at'],
    notification_id: cursor['notification_id'],
  };
}

/** RPC 행은 공용 알림 경계를 통과한 뒤에만 HTTP 응답이 된다. */
export function asNotificationInboxListResponse(value: unknown): NotificationInboxListResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const payload = value as Record<string, unknown>;
  if (
    !Array.isArray(payload['items']) ||
    !Number.isInteger(payload['unread_count']) ||
    (payload['unread_count'] as number) < 0
  ) {
    return null;
  }

  const items = payload['items'].map(asNotificationInboxItem);
  if (items.some((item) => item === null)) return null;

  const nextCursor = payload['next_cursor'] === null ? null : asCursor(payload['next_cursor']);
  if (nextCursor === null && payload['next_cursor'] !== null) return null;

  return {
    items: items as NotificationInboxListResponse['items'],
    unread_count: payload['unread_count'] as number,
    next_cursor: nextCursor,
  };
}

export function asNotificationReadResponse(value: unknown): NotificationReadResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const payload = value as Record<string, unknown>;
  if (
    typeof payload['notification_id'] !== 'string' ||
    !UUID_PATTERN.test(payload['notification_id']) ||
    !isIsoInstant(payload['read_at'])
  ) {
    return null;
  }
  return { notification_id: payload['notification_id'], read_at: payload['read_at'] };
}

export function asNotificationReadAllResponse(value: unknown): NotificationReadAllResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const readCount = (value as Record<string, unknown>)['read_count'];
  if (!Number.isInteger(readCount) || (readCount as number) < 0) return null;
  return { read_count: readCount as number };
}
