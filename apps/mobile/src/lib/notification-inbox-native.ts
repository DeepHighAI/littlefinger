import type {
  NotificationInboxListRequest,
  NotificationInboxListResponse,
  NotificationReadAllResponse,
  NotificationReadResponse,
} from '@littlefinger/shared';
import * as Crypto from 'expo-crypto';

import {
  listNotificationInbox as listNotificationInboxWith,
  markAllNotificationsRead as markAllNotificationsReadWith,
  markNotificationRead as markNotificationReadWith,
} from './notification-inbox-api.ts';
import { callMobileFunctionNative } from './mobile-api-native.ts';

const deps = { call: callMobileFunctionNative };

export async function listNotificationInbox(
  input: NotificationInboxListRequest = {},
): Promise<NotificationInboxListResponse> {
  return await listNotificationInboxWith(input, deps);
}

export async function markNotificationRead(
  notificationId: string,
  idempotencyKey: string,
): Promise<NotificationReadResponse> {
  return await markNotificationReadWith(notificationId, idempotencyKey, deps);
}

export async function markAllNotificationsRead(
  idempotencyKey: string,
): Promise<NotificationReadAllResponse> {
  return await markAllNotificationsReadWith(idempotencyKey, deps);
}

export function createNotificationReadIdempotencyKey(): string {
  return Crypto.randomUUID();
}
