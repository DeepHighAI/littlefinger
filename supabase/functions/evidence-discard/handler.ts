import {
  EVIDENCE_BUCKET,
  type EvidenceDeps,
} from '../_shared/evidence.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import {
  idempotencyKeyOf,
  jsonBody,
  requiredString,
} from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

interface DiscardedUpload {
  upload_id: string;
  status: 'DISCARDED';
  storage_key?: string | null;
  thumb_key?: string | null;
}

export function createEvidenceDiscardHandler(deps: EvidenceDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'upload_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      idempotencyKeyOf(request);
      const body = await jsonBody(request, 'upload_id');
      const uploadId = requiredString(body, 'upload_id', 'upload_id');
      if (!UUID_PATTERN.test(uploadId)) {
        throw new ApiError('E_VALIDATION', { field: 'upload_id' });
      }

      const raw = await deps.rpc('lf_evidence_upload_discard', {
        p_actor: actor,
        p_upload_id: uploadId,
      });
      if (
        typeof raw !== 'object' ||
        raw === null ||
        !('upload_id' in raw) ||
        !('status' in raw)
      ) {
        throw new Error('invalid evidence discard response');
      }
      const discarded = raw as DiscardedUpload;
      const keys = [discarded.storage_key, discarded.thumb_key].filter(
        (key): key is string => typeof key === 'string' && key.length > 0,
      );
      if (keys.length > 0) {
        try {
          await deps.storage.remove(EVIDENCE_BUCKET, keys);
        } catch {
          // DB 상태는 이미 DISCARDED다. J-08이 남은 객체를 다시 정리한다.
          deps.log.error('evidence discard cleanup failed', {
            endpoint: 'evidence-discard',
            reason: 'STORAGE_CLEANUP_FAILED',
          });
        }
      }
      return jsonResponse({ upload_id: discarded.upload_id, status: discarded.status }, 200);
    } catch (raised) {
      return failureResponse(raised, {
        validation: { field: 'upload_id', message: null },
        log: deps.log.error,
      });
    }
  };
}
