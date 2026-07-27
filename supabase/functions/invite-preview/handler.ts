// invite-preview — 02 §4-3-4 (SCR-W02 약속 검토, 로그인 **후**).
//
// SCR-W02 의 유일한 서버 읽기 경로다. `invite-resolve` 는 로그인 전 화면(SCR-W01)용이고
// 그 함수의 본질은 **돌려주지 않는 것**이라 넓힐 수 없었다(PO 가 기각, 2026-07-27).
// RLS 도 답이 아니다 — PENDING 시점의 상대방에게는 `promise_participants` 행이 아직 없다.
//
// 승인의 **읽기 쌍둥이**다. 껍데기가 하는 일: JWT → user id, 토큰 파싱, RPC, 에러 매핑.
// 판정은 전부 `lf_invite_preview` 안에 있고, 그 함수는 `stable` 이라 초대를 소모할 수 없다.
//
// 이 함수에만 없는 것 셋:
// - **`Idempotency-Key` 가 없다.** 상태를 바꾸지 않으므로 재시도에 캐시할 것이 없다.
// - **알림이 없다.** 읽기다. §8-1 에 대응하는 NT-* 이벤트가 존재하지 않는다.
// - **빈도 제한이 없다.** `invite-resolve` 에 그것이 붙은 이유는 `verify_jwt = false` 라
//   인터넷 전체가 열쇠 없이 부를 수 있어서다(PO 2026-07-27). 이쪽은 `verify_jwt = true` 고
//   그 위에 1회용 토큰까지 요구하므로, 승인·거절·수정 제안과 같은 조건이다 — 그 셋도
//   빈도 제한이 없다. 여기만 붙이면 같은 관문을 지난 네 함수 중 하나만 다르게 취급하는 셈이다.

import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { inviteTokenHash } from '../_shared/hash.ts';
import { jsonBody, requiredString } from '../_shared/request.ts';

export function createInvitePreviewHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'token' });
      }

      // 인증이 토큰 파싱보다 먼저다. RPC 도 행위자를 먼저 보므로 순서가 같다 —
      // 로그인하지 않은 호출에 "토큰 형식이 틀렸다"고 답할 이유가 없다.
      const userId = await deps.authenticate(request.headers.get('authorization'));

      // 토큰은 본문으로 받는다. 쿼리스트링에 실으면 프록시·브라우저 히스토리·서버 액세스
      // 로그에 원문이 남아, "원본 토큰 미저장"(§13)이 DB 밖에서 깨진다.
      const body = await jsonBody(request);
      const token = requiredString(body, 'token', 'token');

      const payload = await deps.rpc('lf_invite_preview', {
        // 발급·조회·승인이 모두 `inviteTokenHash` 한 곳을 쓴다. 여기서 한 글자라도
        // 어긋나면 멀쩡한 링크가 전부 E_NOT_FOUND 로 죽고, 원문은 저장되지 않으므로
        // 사후에 원인을 좁힐 단서가 남지 않는다.
        p_token_hash: await inviteTokenHash(token, deps.secrets.invitePepper),
        p_user_id: userId,
      });

      return jsonResponse(payload, 200);
    } catch (raised) {
      // `validation` 을 넘기지 않는다. 이 함수의 `E_VALIDATION` 은 껍데기가 던지는
      // 토큰 형식 오류뿐이고, 그건 이미 자기 필드를 알고 있다. EC-B10 의 종료일 안내를
      // 여기 붙이면 안 된다 — 검토 화면은 종료일이 지나도 **정상 응답**을 받고,
      // 버튼 비활성화와 [종료일 변경 요청하기]는 클라이언트가 D-Day 로 판단한다.
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
