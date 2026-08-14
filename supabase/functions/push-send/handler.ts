import { processNotificationOutbox } from '../_shared/outbox.ts';

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const INVOCATION_BUDGET_MS = 45_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface PushSendDeps {
  secret: string;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  fetch: typeof fetch;
  now: () => Date;
  /** 단조 증가 시계다. 핸들러가 요청마다 기준점을 잡아 wall clock 변경과 warm start를 격리한다. */
  elapsedMs: () => number;
  log: { error: (message: string, detail: unknown) => void };
}

interface DeliveryClaim {
  id: string;
  notification_id: string;
  device_token_id: string | null;
  expo_push_token: string | null;
  title: string;
  body: string;
  deeplink: string | null;
  lease_id: string;
}

interface ReceiptClaim {
  id: string;
  notification_id: string;
  device_token_id: string | null;
  expo_ticket_id: string;
  lease_id: string;
}

interface StageCounts {
  receipts: { claimed: number; delivered: number; retried: number; failed: number };
  outbox: { claimed: number; processed: number; failed: number };
  reminders: { claimed: number; sent: number; canceled: number; deferred: number };
  deliveries: { claimed: number; ticketed: number; retried: number; failed: number };
}

type ExpoOutcome = 'retry' | 'failed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function deliveryClaims(value: unknown): DeliveryClaim[] {
  return rows(value).slice(0, 500).flatMap((row) => {
    if (
      typeof row['id'] !== 'string' ||
      typeof row['notification_id'] !== 'string' ||
      typeof row['lease_id'] !== 'string' ||
      typeof row['title'] !== 'string' ||
      typeof row['body'] !== 'string'
    ) return [];
    return [{
      id: row['id'],
      notification_id: row['notification_id'],
      device_token_id: typeof row['device_token_id'] === 'string' ? row['device_token_id'] : null,
      expo_push_token: typeof row['expo_push_token'] === 'string' ? row['expo_push_token'] : null,
      title: row['title'],
      body: row['body'],
      deeplink: typeof row['deeplink'] === 'string' ? row['deeplink'] : null,
      lease_id: row['lease_id'],
    }];
  });
}

function receiptClaims(value: unknown): ReceiptClaim[] {
  return rows(value).slice(0, 1000).flatMap((row) => {
    if (
      typeof row['id'] !== 'string' ||
      typeof row['notification_id'] !== 'string' ||
      typeof row['expo_ticket_id'] !== 'string' ||
      typeof row['lease_id'] !== 'string'
    ) return [];
    return [{
      id: row['id'],
      notification_id: row['notification_id'],
      device_token_id: typeof row['device_token_id'] === 'string' ? row['device_token_id'] : null,
      expo_ticket_id: row['expo_ticket_id'],
      lease_id: row['lease_id'],
    }];
  });
}

async function safeEqual(left: string | null, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left ?? '')),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function expoRequest(
  deps: PushSendDeps,
  url: string,
  body: unknown,
): Promise<{ response: Response | null; failure: ExpoOutcome; errorCode: string }> {
  const controller = new AbortController();
  const remainingBudget = Math.max(1, INVOCATION_BUDGET_MS - deps.elapsedMs());
  const timeout = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remainingBudget));
  try {
    const response = await deps.fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.ok) return { response, failure: 'failed', errorCode: '' };
    const retry = response.status === 429 || response.status >= 500;
    return {
      response: null,
      failure: retry ? 'retry' : 'failed',
      errorCode: `HTTP_${response.status}`,
    };
  } catch {
    return { response: null, failure: 'retry', errorCode: 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timeout);
  }
}

function expoError(item: unknown): { outcome: ExpoOutcome; errorCode: string } {
  const detail = isRecord(item) && isRecord(item['details']) ? item['details']['error'] : undefined;
  const errorCode = typeof detail === 'string' ? detail : 'ExpoPayloadError';
  return { outcome: errorCode === 'MessageRateExceeded' ? 'retry' : 'failed', errorCode };
}

function notificationIds(result: unknown): string[] {
  if (!isRecord(result) || !Array.isArray(result['notification_ids'])) return [];
  return result['notification_ids'].filter((value): value is string => typeof value === 'string');
}

function count(result: unknown, key: string): number {
  return isRecord(result) && typeof result[key] === 'number' ? result[key] : 0;
}

async function refresh(deps: PushSendDeps, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await deps.rpc('lf_push_refresh_notification_status', {
    p_notification_ids: [...new Set(ids)],
    p_now: deps.now().toISOString(),
  });
}

async function processReceipts(deps: PushSendDeps, counts: StageCounts['receipts']): Promise<void> {
  const claims = receiptClaims(await deps.rpc('lf_push_claim_receipts', {
    p_now: deps.now().toISOString(), p_limit: 1000, p_lease_seconds: 60,
  }));
  counts.claimed = claims.length;
  const results: Record<string, unknown>[] = [];

  for (const batch of chunks(claims, 1000)) {
    if (deps.elapsedMs() >= INVOCATION_BUDGET_MS) break;
    const request = await expoRequest(deps, EXPO_RECEIPTS_URL, { ids: batch.map((row) => row.expo_ticket_id) });
    if (request.response === null) {
      results.push(...batch.map((row) => ({
        delivery_id: row.id, lease_id: row.lease_id, expo_ticket_id: row.expo_ticket_id,
        outcome: request.failure, error_code: request.errorCode,
      })));
      continue;
    }
    const parsed = await request.response.json() as unknown;
    const data = isRecord(parsed) && isRecord(parsed['data']) ? parsed['data'] : {};
    for (const row of batch) {
      const receipt = data[row.expo_ticket_id];
      if (!isRecord(receipt)) {
        results.push({ delivery_id: row.id, lease_id: row.lease_id, expo_ticket_id: row.expo_ticket_id, outcome: 'failed', error_code: 'ReceiptUnavailable' });
      } else if (receipt['status'] === 'ok') {
        results.push({ delivery_id: row.id, lease_id: row.lease_id, expo_ticket_id: row.expo_ticket_id, outcome: 'delivered' });
      } else {
        const error = expoError(receipt);
        results.push({ delivery_id: row.id, lease_id: row.lease_id, expo_ticket_id: row.expo_ticket_id, outcome: error.outcome, error_code: error.errorCode });
      }
    }
  }
  if (results.length === 0) return;
  const recorded = await deps.rpc('lf_push_record_receipts', { p_results: results, p_now: deps.now().toISOString() });
  counts.delivered = count(recorded, 'delivered');
  counts.retried = count(recorded, 'retried');
  counts.failed = count(recorded, 'failed');
  await refresh(deps, notificationIds(recorded));
}

async function processDeliveries(deps: PushSendDeps, counts: StageCounts['deliveries']): Promise<void> {
  const claims = deliveryClaims(await deps.rpc('lf_push_claim_deliveries', {
    p_now: deps.now().toISOString(), p_limit: 500, p_lease_seconds: 60,
  }));
  counts.claimed = claims.length;
  const results: Record<string, unknown>[] = [];

  for (const batch of chunks(claims, 100)) {
    if (deps.elapsedMs() >= INVOCATION_BUDGET_MS) break;
    const valid = batch.filter((row) => row.expo_push_token !== null);
    results.push(...batch.filter((row) => row.expo_push_token === null).map((row) => ({
      delivery_id: row.id, lease_id: row.lease_id, outcome: 'failed',
      error_code: 'DeviceTokenUnavailable', attempted: false,
    })));
    if (valid.length === 0) continue;
    const request = await expoRequest(deps, EXPO_SEND_URL, valid.map((row) => ({
      to: row.expo_push_token, title: row.title, body: row.body,
      data: row.deeplink === null ? {} : { deeplink: row.deeplink },
    })));
    if (request.response === null) {
      results.push(...valid.map((row) => ({
        delivery_id: row.id, lease_id: row.lease_id, outcome: request.failure,
        error_code: request.errorCode, attempted: true,
        device_token_id: row.device_token_id, expo_push_token: row.expo_push_token,
      })));
      continue;
    }
    const parsed = await request.response.json() as unknown;
    const data = isRecord(parsed) && Array.isArray(parsed['data']) ? parsed['data'] : [];
    for (let index = 0; index < valid.length; index += 1) {
      const row = valid[index]!;
      const ticket = data[index];
      if (isRecord(ticket) && ticket['status'] === 'ok' && typeof ticket['id'] === 'string') {
        results.push({ delivery_id: row.id, lease_id: row.lease_id, outcome: 'ticket', expo_ticket_id: ticket['id'], attempted: true });
      } else {
        const error = expoError(ticket);
        results.push({ delivery_id: row.id, lease_id: row.lease_id, outcome: error.outcome,
          error_code: error.errorCode, attempted: true, device_token_id: row.device_token_id,
          expo_push_token: row.expo_push_token });
      }
    }
  }
  if (results.length === 0) return;
  const recorded = await deps.rpc('lf_push_record_tickets', { p_results: results, p_now: deps.now().toISOString() });
  counts.ticketed = count(recorded, 'ticketed');
  counts.retried = count(recorded, 'retried');
  counts.failed = count(recorded, 'failed');
  await refresh(deps, notificationIds(recorded));
}

/** 내부 cron/trigger가 호출하는 단일 bounded worker. 응답에는 stage count만 담는다. */
export function createPushSendHandler(deps: PushSendDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST' || !(await safeEqual(request.headers.get('x-push-send-secret'), deps.secret))) {
      return new Response(null, { status: 401 });
    }
    const startedAt = deps.elapsedMs();
    const invocationDeps: PushSendDeps = {
      ...deps,
      elapsedMs: () => deps.elapsedMs() - startedAt,
    };
    const counts: StageCounts = {
      receipts: { claimed: 0, delivered: 0, retried: 0, failed: 0 },
      outbox: { claimed: 0, processed: 0, failed: 0 },
      reminders: { claimed: 0, sent: 0, canceled: 0, deferred: 0 },
      deliveries: { claimed: 0, ticketed: 0, retried: 0, failed: 0 },
    };
    try {
      if (invocationDeps.elapsedMs() < INVOCATION_BUDGET_MS) await processReceipts(invocationDeps, counts.receipts);
      if (invocationDeps.elapsedMs() < INVOCATION_BUDGET_MS) {
        counts.outbox = await processNotificationOutbox({
          rpc: invocationDeps.rpc,
          now: invocationDeps.now,
          log: { error: () => invocationDeps.log.error('push stage failed', { stage: 'outbox', count: 1 }) },
        }, { limit: 100 });
      }
      if (invocationDeps.elapsedMs() < INVOCATION_BUDGET_MS) {
        const reminders = await invocationDeps.rpc('lf_dispatch_due_reminders', { p_now: invocationDeps.now().toISOString(), p_limit: 200 });
        counts.reminders = {
          claimed: count(reminders, 'claimed'), sent: count(reminders, 'sent'),
          canceled: count(reminders, 'canceled'), deferred: count(reminders, 'deferred'),
        };
      }
      if (invocationDeps.elapsedMs() < INVOCATION_BUDGET_MS) await processDeliveries(invocationDeps, counts.deliveries);
    } catch {
      deps.log.error('push stage failed', { stage: 'worker', count: 1 });
    }
    return Response.json(counts);
  };
}
