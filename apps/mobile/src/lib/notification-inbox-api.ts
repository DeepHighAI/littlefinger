import {
  ENDPOINT,
  type Endpoint,
  type NotificationInboxListRequest,
  type NotificationInboxListResponse,
  type NotificationReadAllResponse,
  type NotificationReadResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface NotificationInboxApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function listNotificationInbox(
  input: NotificationInboxListRequest,
  deps: NotificationInboxApiDeps,
): Promise<NotificationInboxListResponse> {
  return await deps.call(ENDPOINT.notificationInbox, input, { idempotent: false });
}

export async function markNotificationRead(
  notificationId: string,
  idempotencyKey: string,
  deps: NotificationInboxApiDeps,
): Promise<NotificationReadResponse> {
  return await deps.call(
    ENDPOINT.notificationRead,
    { notification_id: notificationId },
    { idempotent: true, idempotencyKey },
  );
}

export async function markAllNotificationsRead(
  idempotencyKey: string,
  deps: NotificationInboxApiDeps,
): Promise<NotificationReadAllResponse> {
  return await deps.call(
    ENDPOINT.notificationReadAll,
    {},
    { idempotent: true, idempotencyKey },
  );
}
