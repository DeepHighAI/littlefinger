import type {
  FulfillmentNotificationRecipient,
  FulfillmentReopenResponse,
  FulfillmentSubmitResponse,
} from '../../../packages/shared/src/api.ts';
import {
  NOTIFICATION_DEEPLINK,
  NOTIFICATION_TITLE,
  fulfillmentDedupeKey,
  type FulfillmentNotificationEvent,
} from '../../../packages/shared/src/notification.ts';
import type { Deps } from './deps.ts';
import type { NotificationRow } from './notify.ts';

const TERMINAL_EVENT = {
  COMPLETED: 'NT-11',
  BROKEN: 'NT-12',
  DISPUTED: 'NT-13',
} as const;

function recipientsOf(value: unknown): FulfillmentNotificationRecipient[] | null {
  if (!Array.isArray(value)) return null;
  const recipients: FulfillmentNotificationRecipient[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const row = item as Record<string, unknown>;
    if (
      typeof row['user_id'] !== 'string' ||
      (row['role'] !== 'CREATOR' && row['role'] !== 'PARTNER' && row['role'] !== 'WITNESS')
    ) {
      return null;
    }
    recipients.push({ user_id: row['user_id'], role: row['role'] });
  }
  return recipients;
}

function asSubmitPayload(value: unknown): FulfillmentSubmitResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const recipients = recipientsOf(row['notification_recipients']);
  if (
    typeof row['promise_id'] !== 'string' ||
    typeof row['title'] !== 'string' ||
    typeof row['actor_nickname'] !== 'string' ||
    typeof row['round_no'] !== 'number' ||
    typeof row['waiting_for_partner'] !== 'boolean' ||
    typeof row['submitted_at'] !== 'string' ||
    (row['revised_at'] !== null && typeof row['revised_at'] !== 'string') ||
    (row['status'] !== 'CHECKING' &&
      row['status'] !== 'COMPLETED' &&
      row['status'] !== 'BROKEN' &&
      row['status'] !== 'DISPUTED') ||
    recipients === null
  ) {
    return null;
  }
  return {
    promise_id: row['promise_id'],
    title: row['title'],
    actor_nickname: row['actor_nickname'],
    round_no: row['round_no'],
    waiting_for_partner: row['waiting_for_partner'],
    submitted_at: row['submitted_at'],
    revised_at: row['revised_at'],
    status: row['status'],
    notification_recipients: recipients,
  };
}

function asReopenPayload(value: unknown): FulfillmentReopenResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const recipients = recipientsOf(row['notification_recipients']);
  if (
    typeof row['promise_id'] !== 'string' ||
    typeof row['title'] !== 'string' ||
    typeof row['round_no'] !== 'number' ||
    typeof row['check_deadline_at'] !== 'string' ||
    row['status'] !== 'CHECKING' ||
    recipients === null
  ) {
    return null;
  }
  return {
    promise_id: row['promise_id'],
    title: row['title'],
    round_no: row['round_no'],
    check_deadline_at: row['check_deadline_at'],
    status: 'CHECKING',
    notification_recipients: recipients,
  };
}

function notificationRow(input: {
  event: FulfillmentNotificationEvent;
  recipient: FulfillmentNotificationRecipient;
  promiseId: string;
  title: string;
  actorNickname: string;
  roundNo: number;
  idempotencyKey: string;
  now: Date;
}): NotificationRow {
  const channel = 'INAPP' as const;
  return {
    user_id: input.recipient.user_id,
    promise_id: input.promiseId,
    type: input.event,
    channel,
    title: NOTIFICATION_TITLE[input.event](input.actorNickname),
    body: input.title,
    deeplink: NOTIFICATION_DEEPLINK[input.event],
    status: 'SENT',
    sent_at: input.now.toISOString(),
    dedupe_key: fulfillmentDedupeKey({
      promiseId: input.promiseId,
      event: input.event,
      userId: input.recipient.user_id,
      channel,
      roundNo: input.roundNo,
      idempotencyKey: input.idempotencyKey,
    }),
  };
}

async function insertRows(
  rows: readonly NotificationRow[],
  event: FulfillmentNotificationEvent,
  deps: Deps,
): Promise<void> {
  for (const row of rows) {
    try {
      await deps.insertNotification(row);
    } catch {
      deps.log.error('notification insert failed', {
        event,
        reason: 'INSERT_FAILED',
      });
    }
  }
}

export async function notifyFulfillmentSubmit(
  value: unknown,
  actorId: string,
  idempotencyKey: string,
  deps: Deps,
): Promise<void> {
  const payload = asSubmitPayload(value);
  if (payload === null) {
    deps.log.error('RPC payload is missing fulfillment notification fields', {
      endpoint: 'fulfillment-submit',
    });
    return;
  }

  let event: FulfillmentNotificationEvent;
  let recipients: readonly FulfillmentNotificationRecipient[];
  if (
    payload.status === 'CHECKING' &&
    payload.waiting_for_partner &&
    payload.revised_at === null
  ) {
    event = 'NT-09';
    recipients = payload.notification_recipients.filter(
      (recipient) =>
        recipient.user_id !== actorId &&
        (recipient.role === 'CREATOR' || recipient.role === 'PARTNER'),
    );
  } else if (payload.status in TERMINAL_EVENT) {
    event = TERMINAL_EVENT[payload.status as keyof typeof TERMINAL_EVENT];
    recipients = payload.notification_recipients;
  } else {
    return;
  }

  const now = deps.now();
  await insertRows(
    recipients.map((recipient) =>
      notificationRow({
        event,
        recipient,
        promiseId: payload.promise_id,
        title: payload.title,
        actorNickname: payload.actor_nickname,
        roundNo: payload.round_no,
        idempotencyKey,
        now,
      }),
    ),
    event,
    deps,
  );
}

export async function notifyFulfillmentReopen(
  value: unknown,
  idempotencyKey: string,
  deps: Deps,
): Promise<void> {
  const payload = asReopenPayload(value);
  if (payload === null) {
    deps.log.error('RPC payload is missing fulfillment notification fields', {
      endpoint: 'fulfillment-reopen',
    });
    return;
  }
  const event = 'NT-19';
  const now = deps.now();
  await insertRows(
    payload.notification_recipients.map((recipient) =>
      notificationRow({
        event,
        recipient,
        promiseId: payload.promise_id,
        title: payload.title,
        actorNickname: '',
        roundNo: payload.round_no,
        idempotencyKey,
        now,
      }),
    ),
    event,
    deps,
  );
}
