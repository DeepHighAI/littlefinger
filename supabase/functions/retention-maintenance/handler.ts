import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { EVIDENCE_BUCKET, type EvidenceStorage } from '../_shared/evidence.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { UUID_PATTERN } from '../_shared/monetization.ts';

interface PurgeJob {
  promise_id: string;
  lease_id: string;
  storage_keys: string[];
}

export interface RetentionMaintenanceDeps extends Pick<Deps, 'rpc' | 'log' | 'now'> {
  workerSecret: string;
  storage: Pick<EvidenceStorage, 'remove'>;
}

function secretsMatch(actual: string | null, expected: string): boolean {
  if (actual === null || actual.length !== expected.length || expected.length === 0) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function itemsOf(value: unknown): unknown[] {
  if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)) {
    throw new Error('INVALID_PURGE_JOBS');
  }
  return value.items;
}

/** 형태가 어긋난 작업은 `null` — 하나가 깨졌다고 나머지 청구분까지 버리지 않는다. */
function jobOf(value: unknown): PurgeJob | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const promiseId = row['promise_id'];
  const leaseId = row['lease_id'];
  const storageKeys = row['storage_keys'];
  if (
    typeof promiseId !== 'string' || !UUID_PATTERN.test(promiseId) ||
    typeof leaseId !== 'string' || !UUID_PATTERN.test(leaseId) ||
    !Array.isArray(storageKeys) || !storageKeys.every((key): key is string => typeof key === 'string')
  ) return null;
  return { promise_id: promiseId, lease_id: leaseId, storage_keys: storageKeys };
}

export function createRetentionMaintenanceHandler(deps: RetentionMaintenanceDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST' || !secretsMatch(
        request.headers.get('x-retention-worker-secret'), deps.workerSecret,
      )) throw new ApiError('E_AUTH_REQUIRED');

      const now = deps.now().toISOString();
      const maintenance = await deps.rpc('lf_retention_maintenance', { p_now: now });
      const items = itemsOf(await deps.rpc('lf_purge_job_claim', { p_now: now, p_limit: 50 }));
      let purgedCount = 0;
      let failedCount = 0;
      for (const item of items) {
        const job = jobOf(item);
        if (job === null) {
          failedCount += 1;
          deps.log.error('retention purge skipped', 'INVALID_PURGE_JOB');
          continue;
        }
        try {
          if (job.storage_keys.length > 0) {
            await deps.storage.remove(EVIDENCE_BUCKET, job.storage_keys);
          }
          const finalized = await deps.rpc('lf_purge_job_finalize', {
            p_promise_id: job.promise_id,
            p_lease_id: job.lease_id,
            p_now: deps.now().toISOString(),
          });
          if (finalized === true) purgedCount += 1;
        } catch {
          failedCount += 1;
          // Storage·RPC 메시지는 객체 키와 행 식별자를 담을 수 있다 — 고정 분류만 남긴다.
          deps.log.error('retention purge failed', 'PURGE_JOB_FAILED');
        }
      }
      return jsonResponse({
        maintenance,
        claimed_count: items.length,
        purged_count: purgedCount,
        failed_count: failedCount,
      }, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
