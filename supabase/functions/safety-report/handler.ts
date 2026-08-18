import { asSafetyReportResponse } from '../../../packages/shared/src/account-safety.ts';
import { safetyReportOf } from '../_shared/account-safety.ts';
import type { Deps } from '../_shared/deps.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export function createSafetyReportHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const input = safetyReportOf(await jsonBody(request, 'reason'));
      const payload = asSafetyReportResponse(await deps.rpc('lf_safety_report', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_promise_id: input.promiseId,
        p_target_user_id: input.targetUserId,
        p_evidence_id: input.evidenceId,
        p_reason: input.reason,
        p_detail: input.detail,
      }));
      if (payload === null) throw new Error('INVALID_SAFETY_REPORT_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { validation: { field: 'reason', message: null }, log: deps.log.error });
    }
  };
}
