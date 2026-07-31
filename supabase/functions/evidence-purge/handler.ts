import type { EvidencePurgeDeps } from '../_shared/evidence.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';

interface PurgeTarget {
  evidence_id?: string;
  upload_id?: string;
  bucket_id: string;
  storage_key: string | null;
  thumb_key: string | null;
}

interface PurgeTargets {
  evidences: PurgeTarget[];
  uploads: PurgeTarget[];
}

function secretsMatch(actual: string | null, expected: string): boolean {
  if (actual === null || actual.length !== expected.length || expected.length === 0) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function targetsOf(value: unknown): PurgeTargets {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('evidences' in value) ||
    !Array.isArray(value.evidences) ||
    !('uploads' in value) ||
    !Array.isArray(value.uploads)
  ) {
    throw new Error('invalid evidence purge targets');
  }
  return value as unknown as PurgeTargets;
}

async function removeTarget(
  target: PurgeTarget,
  deps: EvidencePurgeDeps,
): Promise<boolean> {
  const keys = [target.storage_key, target.thumb_key].filter(
    (key): key is string => typeof key === 'string' && key.length > 0,
  );
  try {
    if (keys.length > 0) await deps.storage.remove(target.bucket_id, keys);
    return true;
  } catch {
    deps.log.error('evidence purge storage removal failed', {
      endpoint: 'evidence-purge',
      reason: 'STORAGE_REMOVE_FAILED',
    });
    return false;
  }
}

export function createEvidencePurgeHandler(deps: EvidencePurgeDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_AUTH_REQUIRED');
      if (
        !secretsMatch(
          request.headers.get('x-evidence-purge-secret'),
          deps.purgeSecret,
        )
      ) {
        throw new ApiError('E_AUTH_REQUIRED');
      }

      const targets = targetsOf(
        await deps.rpc('lf_evidence_purge_targets', {
          p_now: deps.now().toISOString(),
          p_limit: 100,
        }),
      );
      const evidenceIds: string[] = [];
      const uploadIds: string[] = [];
      let failedCount = 0;

      for (const target of targets.evidences) {
        if (await removeTarget(target, deps)) {
          if (typeof target.evidence_id === 'string') evidenceIds.push(target.evidence_id);
        } else {
          failedCount += 1;
        }
      }
      for (const target of targets.uploads) {
        if (await removeTarget(target, deps)) {
          if (typeof target.upload_id === 'string') uploadIds.push(target.upload_id);
        } else {
          failedCount += 1;
        }
      }

      const completed = await deps.rpc('lf_evidence_purge_complete', {
        p_evidence_ids: evidenceIds,
        p_upload_ids: uploadIds,
      });
      const counts =
        typeof completed === 'object' && completed !== null
          ? (completed as { evidence_count?: unknown; upload_count?: unknown })
          : {};
      return jsonResponse(
        {
          evidence_count:
            typeof counts.evidence_count === 'number' ? counts.evidence_count : 0,
          upload_count:
            typeof counts.upload_count === 'number' ? counts.upload_count : 0,
          failed_count: failedCount,
        },
        200,
      );
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
