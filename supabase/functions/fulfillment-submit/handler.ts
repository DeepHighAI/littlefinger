import { EVIDENCE_MAX_COUNT } from '../../../packages/shared/src/config.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody, requiredString, surfaceOf } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function evidenceIdsOf(
  body: Record<string, unknown>,
  key: 'evidence_upload_ids' | 'retained_evidence_ids',
): string[] {
  const value = body[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ApiError('E_VALIDATION', { field: 'evidences' });
  }

  const field = key === 'evidence_upload_ids' ? 'upload_id' : 'evidence_id';
  for (const id of value) {
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      throw new ApiError('E_VALIDATION', { field });
    }
  }
  return value as string[];
}

export function createFulfillmentSubmitHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const body = await jsonBody(request, 'promise_id');
      const promiseId = requiredString(body, 'promise_id', 'promise_id');
      if (!UUID_PATTERN.test(promiseId)) {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const answer = body['answer'];
      if (answer !== 'KEPT' && answer !== 'NOT_KEPT') {
        throw new ApiError('E_VALIDATION', { field: 'answer' });
      }
      const comment = body['comment'];
      if (comment !== undefined && typeof comment !== 'string') {
        throw new ApiError('E_VALIDATION', { field: 'comment' });
      }
      const revise = body['revise'];
      if (revise !== undefined && typeof revise !== 'boolean') {
        throw new ApiError('E_VALIDATION', { field: 'revise' });
      }
      const evidenceUploadIds = evidenceIdsOf(body, 'evidence_upload_ids');
      const retainedEvidenceIds = evidenceIdsOf(body, 'retained_evidence_ids');
      if (
        evidenceUploadIds.length + retainedEvidenceIds.length > EVIDENCE_MAX_COUNT ||
        new Set([...evidenceUploadIds, ...retainedEvidenceIds]).size !==
          evidenceUploadIds.length + retainedEvidenceIds.length
      ) {
        throw new ApiError('E_VALIDATION', { field: 'evidences' });
      }

      const payload = await deps.rpc('lf_fulfillment_submit', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_promise_id: promiseId,
        p_answer: answer,
        p_comment: comment ?? null,
        p_revise: revise ?? false,
        p_evidence_upload_ids: evidenceUploadIds,
        p_retained_evidence_ids: retainedEvidenceIds,
        p_surface: surfaceOf(request),
      });
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, {
        validation: { field: 'comment', message: null },
        log: deps.log.error,
      });
    }
  };
}
