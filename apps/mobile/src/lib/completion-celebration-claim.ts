import type {
  CompletionCelebrationClaimResponse,
  CompletionCelebrationShownResponse,
  CompletionCelebrationView,
} from '@littlefinger/shared';

import type { LargeSecureStore } from './large-secure-store.ts';

export type CompletionClaimEnvelope =
  | { phase: 'PENDING'; claim_idempotency_key: string }
  | { phase: 'SHOWN'; claim_id: string; shown_idempotency_key: string };

export interface CompletionCelebrationClaimDeps {
  currentUserId(): Promise<string>;
  randomUuid(): string;
  storage: Pick<LargeSecureStore, 'getItem' | 'setItem' | 'removeItem'>;
  claimWith(
    promiseId: string,
    idempotencyKey: string,
  ): Promise<CompletionCelebrationClaimResponse>;
  acknowledgeShownWith(
    promiseId: string,
    claimId: string,
    idempotencyKey: string,
  ): Promise<CompletionCelebrationShownResponse>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function asCompletionClaimEnvelope(value: string | null): CompletionClaimEnvelope | null {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (
      record['phase'] === 'PENDING' &&
      Object.keys(record).length === 2 &&
      typeof record['claim_idempotency_key'] === 'string' &&
      UUID_PATTERN.test(record['claim_idempotency_key'])
    ) {
      return parsed as CompletionClaimEnvelope;
    }
    if (
      record['phase'] === 'SHOWN' &&
      Object.keys(record).length === 3 &&
      typeof record['claim_id'] === 'string' &&
      UUID_PATTERN.test(record['claim_id']) &&
      typeof record['shown_idempotency_key'] === 'string' &&
      UUID_PATTERN.test(record['shown_idempotency_key'])
    ) {
      return parsed as CompletionClaimEnvelope;
    }
  } catch {
    return null;
  }
  return null;
}

export function completionCelebrationStorageKey(userId: string, promiseId: string): string {
  return `lf.completion-celebration-claim.${userId}.${promiseId}`;
}

async function loadEnvelope(
  key: string,
  storage: CompletionCelebrationClaimDeps['storage'],
): Promise<CompletionClaimEnvelope | null> {
  const stored = await storage.getItem(key);
  const envelope = asCompletionClaimEnvelope(stored);
  if (stored !== null && envelope === null) await storage.removeItem(key);
  return envelope;
}

export async function claimCompletionCelebration(
  promiseId: string,
  deps: CompletionCelebrationClaimDeps,
): Promise<CompletionCelebrationView | null> {
  const userId = await deps.currentUserId();
  const storageKey = completionCelebrationStorageKey(userId, promiseId);
  let envelope = await loadEnvelope(storageKey, deps.storage);

  if (envelope?.phase === 'SHOWN') {
    await deps.acknowledgeShownWith(
      promiseId,
      envelope.claim_id,
      envelope.shown_idempotency_key,
    );
    await deps.storage.removeItem(storageKey);
    return null;
  }

  if (envelope === null) {
    envelope = {
      phase: 'PENDING',
      claim_idempotency_key: deps.randomUuid(),
    };
    await deps.storage.setItem(storageKey, JSON.stringify(envelope));
  }

  const response = await deps.claimWith(promiseId, envelope.claim_idempotency_key);
  if (!response.available) {
    await deps.storage.removeItem(storageKey);
    return null;
  }
  return response.celebration;
}

export async function markCompletionCelebrationShown(
  promiseId: string,
  claimId: string,
  deps: CompletionCelebrationClaimDeps,
): Promise<void> {
  const userId = await deps.currentUserId();
  const storageKey = completionCelebrationStorageKey(userId, promiseId);
  const existing = await loadEnvelope(storageKey, deps.storage);
  const envelope: Extract<CompletionClaimEnvelope, { phase: 'SHOWN' }> =
    existing?.phase === 'SHOWN'
      ? existing
      : {
          phase: 'SHOWN',
          claim_id: claimId,
          shown_idempotency_key: deps.randomUuid(),
        };

  await deps.storage.setItem(storageKey, JSON.stringify(envelope));
  await deps.acknowledgeShownWith(
    promiseId,
    envelope.claim_id,
    envelope.shown_idempotency_key,
  );
  await deps.storage.removeItem(storageKey);
}
