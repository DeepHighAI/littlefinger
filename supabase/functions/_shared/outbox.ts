import {
  NOTIFICATION_TITLE,
  renderNotificationTemplate,
  type NotificationEvent,
  type NotificationTemplateArgs,
  type RenderedNotificationTemplate,
} from '../../../packages/shared/src/notification.ts';
import type { Logger } from './deps.ts';

export interface NotificationOutboxDeps {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  log: Logger;
  now: () => Date;
}

export interface ProcessNotificationOutboxOptions {
  limit: number;
}

interface ClaimedOutboxRow {
  id: string;
  recipient_user_id: string;
  promise_id: string;
  event: NotificationEvent;
  template_args: NotificationTemplateArgs;
  inapp_dedupe_key: string;
  push_dedupe_key: string;
  lease_id: string;
}

const EVENTS = new Set<string>(Object.keys(NOTIFICATION_TITLE));

function claimedRowsOf(value: unknown): ClaimedOutboxRow[] {
  if (!Array.isArray(value)) throw new Error('INVALID_OUTBOX_CLAIM');
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('INVALID_OUTBOX_CLAIM');
    const row = item as Record<string, unknown>;
    const args = row['template_args'];
    if (
      typeof row['id'] !== 'string' ||
      typeof row['recipient_user_id'] !== 'string' ||
      typeof row['promise_id'] !== 'string' ||
      typeof row['event'] !== 'string' ||
      !EVENTS.has(row['event']) ||
      typeof args !== 'object' ||
      args === null ||
      typeof row['inapp_dedupe_key'] !== 'string' ||
      typeof row['push_dedupe_key'] !== 'string' ||
      typeof row['lease_id'] !== 'string'
    ) {
      throw new Error('INVALID_OUTBOX_CLAIM');
    }
    return {
      id: row['id'],
      recipient_user_id: row['recipient_user_id'],
      promise_id: row['promise_id'],
      event: row['event'] as NotificationEvent,
      template_args: args as unknown as NotificationTemplateArgs,
      inapp_dedupe_key: row['inapp_dedupe_key'],
      push_dedupe_key: row['push_dedupe_key'],
      lease_id: row['lease_id'],
    };
  });
}

/** 한 번의 worker 호출에서 claim한 intent를 서로 격리해 fanout하고 결과를 기록한다. */
export async function processNotificationOutbox(
  deps: NotificationOutboxDeps,
  options: ProcessNotificationOutboxOptions,
): Promise<{ claimed: number; processed: number; failed: number }> {
  let claimed = 0;
  let processed = 0;
  let failed = 0;

  for (let index = 0; index < options.limit; index += 1) {
    const rows = claimedRowsOf(
      await deps.rpc('lf_notification_outbox_claim', {
        p_now: deps.now().toISOString(),
        p_limit: 1,
        p_lease_seconds: 60,
      }),
    );
    const row = rows[0];
    if (row === undefined) break;
    claimed += 1;

    let bodySnapshot: string | null = null;
    let rendered: RenderedNotificationTemplate;
    try {
      rendered = renderNotificationTemplate(row.event, row.template_args);
      bodySnapshot = rendered.body;
    } catch {
      await recordResult(deps, row, false, bodySnapshot, 'TEMPLATE_INVALID');
      deps.log.error('notification outbox processing failed', {
        outbox_id: row.id,
        error_code: 'TEMPLATE_INVALID',
      });
      failed += 1;
      continue;
    }

    try {
      await deps.rpc('lf_notification_fanout', {
        p_user_id: row.recipient_user_id,
        p_promise_id: row.promise_id,
        p_type: row.event,
        p_title: rendered.title,
        p_body: rendered.body,
        p_deeplink: rendered.deeplink,
        p_inapp_dedupe_key: row.inapp_dedupe_key,
        p_push_dedupe_key: row.push_dedupe_key,
        p_now: deps.now().toISOString(),
      });
    } catch {
      await recordResult(deps, row, false, bodySnapshot, 'FANOUT_FAILED');
      deps.log.error('notification outbox processing failed', {
        outbox_id: row.id,
        error_code: 'FANOUT_FAILED',
      });
      failed += 1;
      continue;
    }

    if (await recordResult(deps, row, true, bodySnapshot, null)) processed += 1;
  }

  return { claimed, processed, failed };
}

async function recordResult(
  deps: NotificationOutboxDeps,
  row: ClaimedOutboxRow,
  success: boolean,
  bodySnapshot: string | null,
  errorCode: string | null,
): Promise<boolean> {
  try {
    await deps.rpc('lf_notification_outbox_record', {
      p_outbox_id: row.id,
      p_lease_id: row.lease_id,
      p_success: success,
      p_body_snapshot: bodySnapshot,
      p_error_code: errorCode,
      p_now: deps.now().toISOString(),
    });
    return true;
  } catch (error) {
    deps.log.error('notification outbox record failed', {
      outbox_id: row.id,
      error_code: error instanceof Error ? error.message : 'RECORD_FAILED',
    });
    return false;
  }
}
