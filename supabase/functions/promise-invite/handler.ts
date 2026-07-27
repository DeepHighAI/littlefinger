// promise-invite — 02 §4-3-1 · §4-3-2 (T-02).
//
// 이미 있는 DRAFT 를 보내거나([임시저장] 뒤의 발송) PENDING 인 약속의 초대를 다시 보낸다
// ([초대 다시 보내기]). 재발송은 새 토큰을 발급하고 기존 토큰을 즉시 REVOKED 로 만든다.
//
// `promise-create` 와 마찬가지로 **알림이 없다**(§8-1 "초대 발송 자체는 시스템 알림이 아니다").

import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { attachToken, issueToken } from '../_shared/invite.ts';
import { idempotencyKeyOf, jsonBody, requiredString } from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 이 함수에서 `E_VALIDATION` 은 **종료일 경과 하나뿐**이다. 본문에 사용자가 입력하는 값이
 * 없고 `promise_id` 형식 위반은 껍데기가 자기 필드를 붙여 먼저 던지기 때문이다.
 *
 * 이 판정은 약속이 아직 DRAFT 일 때만 나온다 — PENDING 이면 작성자가 내용을 고칠 수 없어서
 * 종료일을 보지 않는다(EC-B10 의 출구를 막지 않으려고). 그래서 안내는 "고쳐서 다시 보내라"다.
 */
export const INVITE_VALIDATION = {
  field: 'end_date',
  message: '종료일은 내일부터 1년 안으로 정해주세요.',
} as const;

export function createPromiseInviteHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const userId = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const body = await jsonBody(request, 'promise_id');

      const promiseId = requiredString(body, 'promise_id', 'promise_id');
      // UUID 가 아니면 RPC 의 캐스팅이 22P02 로 터져 E_* 가 아닌 500 이 나간다.
      if (!UUID_PATTERN.test(promiseId)) {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const issued = await issueToken(deps.secrets.invitePepper);

      const payload = await deps.rpc('lf_promise_invite', {
        p_idempotency_key: idempotencyKey,
        p_user_id: userId,
        p_promise_id: promiseId,
        // 원문 토큰은 RPC 로 넘어가지 않는다(§13). 서버가 보관하는 것은 해시뿐이다.
        p_token_hash: issued.hash,
      });

      return jsonResponse(attachToken(payload, issued), 200);
    } catch (raised) {
      return failureResponse(raised, { validation: INVITE_VALIDATION, log: deps.log.error });
    }
  };
}
