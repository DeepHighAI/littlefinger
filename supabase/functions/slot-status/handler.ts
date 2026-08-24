import { asSlotStatusResponse } from '../../../packages/shared/src/slots.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { jsonBody } from '../_shared/request.ts';

/**
 * 슬롯 현황 조회 (PO 2026-08-24). 본문 없는 읽기 — trust-profile 과 같은 모양이다.
 * 결제 시트·프로필 행이 이 값을 그대로 그린다. 클라이언트는 스스로 세지 않는다.
 */
export function createSlotStatusHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION');
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request);
      if (Object.keys(body).length > 0) throw new ApiError('E_VALIDATION');
      const payload = asSlotStatusResponse(await deps.rpc('lf_slot_status', { p_actor: actor }));
      if (payload === null) throw new Error('INVALID_SLOT_STATUS_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
