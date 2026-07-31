import type { EvidenceDeps } from '../_shared/evidence.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody, requiredString } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

interface SignTarget {
  evidence_id: string;
  bucket_id: string;
  object_key: string;
  variant: 'THUMBNAIL' | 'FULL';
  expires_in: number;
}

export function createEvidenceSignUrlHandler(deps: EvidenceDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'evidence_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'evidence_id');
      const evidenceId = requiredString(body, 'evidence_id', 'evidence_id');
      const variant = body['variant'];
      if (
        !UUID_PATTERN.test(evidenceId) ||
        (variant !== 'THUMBNAIL' && variant !== 'FULL')
      ) {
        throw new ApiError('E_VALIDATION', {
          field: !UUID_PATTERN.test(evidenceId) ? 'evidence_id' : 'variant',
        });
      }

      const raw = await deps.rpc('lf_evidence_sign_target', {
        p_actor: actor,
        p_evidence_id: evidenceId,
        p_variant: variant,
      });
      if (
        typeof raw !== 'object' ||
        raw === null ||
        !('evidence_id' in raw) ||
        !('bucket_id' in raw) ||
        !('object_key' in raw) ||
        !('variant' in raw) ||
        !('expires_in' in raw)
      ) {
        throw new Error('invalid evidence sign target');
      }
      const target = raw as SignTarget;
      const signedUrl = await deps.storage.sign(
        target.bucket_id,
        target.object_key,
        target.expires_in,
      );
      return jsonResponse(
        {
          evidence_id: target.evidence_id,
          variant: target.variant,
          signed_url: signedUrl,
          expires_at: new Date(
            deps.now().getTime() + target.expires_in * 1000,
          ).toISOString(),
        },
        200,
      );
    } catch (raised) {
      return failureResponse(raised, {
        validation: { field: 'evidence_id', message: null },
        log: deps.log.error,
      });
    }
  };
}
