import { validateEvidences } from '../../../packages/shared/src/validation.ts';
import {
  EVIDENCE_BUCKET,
  evidenceObjectKeys,
  type EvidenceDeps,
  type ReservedEvidenceUpload,
} from '../_shared/evidence.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function reservationOf(value: unknown): ReservedEvidenceUpload {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('upload_id' in value) ||
    !('status' in value) ||
    typeof value.upload_id !== 'string' ||
    typeof value.status !== 'string'
  ) {
    throw new Error('invalid evidence reservation');
  }
  return value as ReservedEvidenceUpload;
}

async function cleanupStored(
  deps: EvidenceDeps,
  keys: readonly string[],
): Promise<void> {
  if (keys.length === 0) return;
  try {
    await deps.storage.remove(EVIDENCE_BUCKET, keys);
  } catch {
    deps.log.error('evidence upload cleanup failed', {
      endpoint: 'evidence-upload',
      reason: 'STORAGE_CLEANUP_FAILED',
    });
  }
}

export function createEvidenceUploadHandler(deps: EvidenceDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    const storedKeys: string[] = [];
    let storing = false;
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'evidences' });
      }

      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        throw new ApiError('E_VALIDATION', { field: 'evidences' });
      }

      const promiseId = form.get('promise_id');
      const roundNoValue = form.get('round_no');
      const file = form.get('file');
      const roundNo =
        typeof roundNoValue === 'string' && /^\d+$/u.test(roundNoValue)
          ? Number(roundNoValue)
          : Number.NaN;

      if (
        typeof promiseId !== 'string' ||
        !UUID_PATTERN.test(promiseId) ||
        !Number.isSafeInteger(roundNo) ||
        roundNo < 1 ||
        !(file instanceof Blob)
      ) {
        throw new ApiError('E_VALIDATION', { field: 'evidences' });
      }

      const validation = validateEvidences([{ mime: file.type, bytes: file.size }]);
      if (!validation.valid) {
        throw new ApiError('E_VALIDATION', { field: 'evidences' });
      }

      const reservation = reservationOf(
        await deps.rpc('lf_evidence_upload_reserve', {
          p_idempotency_key: idempotencyKey,
          p_actor: actor,
          p_promise_id: promiseId,
          p_round_no: roundNo,
        }),
      );
      if (reservation.status === 'READY') return jsonResponse(reservation, 200);
      if (reservation.status !== 'PENDING') throw new ApiError('E_STATE_CONFLICT');

      const image = await deps.processImage({
        bytes: new Uint8Array(await file.arrayBuffer()),
        mime: file.type,
      });
      const { fullKey, thumbnailKey } = evidenceObjectKeys(promiseId, reservation.upload_id);

      storing = true;
      await deps.storage.upload(
        EVIDENCE_BUCKET,
        fullKey,
        image.full.bytes,
        'image/jpeg',
      );
      storedKeys.push(fullKey);
      await deps.storage.upload(
        EVIDENCE_BUCKET,
        thumbnailKey,
        image.thumbnail.bytes,
        'image/jpeg',
      );
      storedKeys.push(thumbnailKey);
      storing = false;

      const completed = reservationOf(
        await deps.rpc('lf_evidence_upload_complete', {
          p_actor: actor,
          p_upload_id: reservation.upload_id,
          p_storage_key: fullKey,
          p_thumb_key: thumbnailKey,
          p_bytes: image.full.bytes.byteLength,
          p_width: image.full.width,
          p_height: image.full.height,
        }),
      );
      return jsonResponse(completed, 200);
    } catch (raised) {
      if (storing) {
        await cleanupStored(deps, storedKeys);
        deps.log.error('evidence upload failed', {
          endpoint: 'evidence-upload',
          reason: 'STORAGE_WRITE_FAILED',
        });
        return failureResponse(new ApiError('E_UPLOAD_FAILED'), { log: deps.log.error });
      }
      return failureResponse(raised, {
        validation: { field: 'evidences', message: null },
        log: deps.log.error,
      });
    }
  };
}
