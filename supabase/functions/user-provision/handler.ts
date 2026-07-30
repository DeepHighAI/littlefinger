// user-provision — 로그인 직후 `public.users` 행 보정 (02 §165, 핸드오프 2026-07-30).
//
// 트리거(`lf_user_stub`)가 대진값으로 만들어 둔 행에 진짜 값을 채운다. 껍데기가 하는 일:
// JWT → user id, 본문 형태 판정, surface 판정, RPC, 에러 매핑. 채움 규칙(먼저 쓴 값이
// 이긴다 · ACTIVE 만 · kakao_id 는 identities 에서)은 전부 `lf_user_provision` 안이다.
//
// **알림이 없다** — §8-1 에 가입 NT-* 이벤트가 없다.
// **Idempotency-Key 가 없다** — RPC 자체가 멱등이라 캐시가 오히려 해롭다: 다음 로그인은
// 다른 표면에서 올 수 있는데, 키를 재사용하면 첫 로그인의 결과에 영구히 고정된다.

import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, noContentResponse } from '../_shared/http.ts';
import { jsonBody, optionalString, surfaceOf } from '../_shared/request.ts';

export function createUserProvisionHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'nickname' });
      }

      const userId = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'nickname');

      // 길이 판정을 하지 않는다 — 사용자 입력이 아니라 카카오 프로필 값이고(§5 밖),
      // 빈 문자열을 NULL 로 되돌리는 일은 RPC 의 nullif 가 한다.
      const nickname = optionalString(body, 'nickname', 'nickname');
      const profileImageUrl = optionalString(body, 'profile_image_url', 'profile_image_url');

      // kakao_id 는 넘기지 않는다 — RPC 가 auth.identities.provider_id 에서 직접 읽는다.
      // 클라이언트 신고를 받으면 남의 회원번호(EC-A05 의 계정 동일성 키)를 주장할 수 있다.
      await deps.rpc('lf_user_provision', {
        p_user_id: userId,
        p_surface: surfaceOf(request),
        p_nickname: nickname,
        p_profile_image_url: profileImageUrl,
      });

      return noContentResponse();
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
