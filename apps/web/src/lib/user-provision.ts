import { ENDPOINT, type UserProvisionRequest } from '@littlefinger/shared';
import type { Session } from '@supabase/supabase-js';

import { functionUrl, getSupabase } from './supabase.ts';

/**
 * 로그인 직후 `public.users` 행 보정(핸드오프 2026-07-30).
 *
 * 트리거는 로그인을 지키려고 대진값(`pending:…`, '사용자', surface NULL)만 쓴다 — 진짜
 * 값은 로그인 **뒤에만** 존재하기 때문이다(`auth.identities` 는 사용자 행보다 늦게 생긴다).
 * 그래서 SIGNED_IN 마다 한 번 보정을 부른다. RPC 가 멱등이라(먼저 쓴 값이 이긴다) 같은
 * 로그인에서 두 번 불려도, 매 로그인마다 불려도 무해하다.
 *
 * `INITIAL_SESSION`(저장된 세션 복원)에는 부르지 않는다 — 새 로그인이 아니고, 복원될
 * 세션이 있다는 것은 그 로그인 때 이미 보정이 나갔다는 뜻이다.
 */

/**
 * 카카오 프로필 → 요청 본문. 키 이름은 gotrue kakao.go 가 정한다(2026-07-30 확인):
 * `Name`/`AvatarURL` claims 가 snake_case 로 `user_metadata.name`·`avatar_url` 이 된다.
 *
 * 없는 키는 **보내지 않는다**. profile_nickname 은 [선택 동의]라(§6-1) 거부하면 키가
 * 아예 없고, 그때 null 이나 '' 를 지어 보내면 서버의 "없으면 대진값 유지"가 무너진다.
 * 형태 검사를 하는 이유: user_metadata 는 `updateUser({data})` 로 사용자가 아무 값이나
 * 넣을 수 있는 자리다.
 */
function provisionBody(session: Session): UserProvisionRequest {
  const metadata: Record<string, unknown> = session.user.user_metadata ?? {};
  const nickname = metadata['name'];
  const profileImageUrl = metadata['avatar_url'];
  return {
    ...(typeof nickname === 'string' ? { nickname } : {}),
    ...(typeof profileImageUrl === 'string' ? { profile_image_url: profileImageUrl } : {}),
  };
}

async function provisionUser(session: Session): Promise<void> {
  try {
    await fetch(functionUrl(ENDPOINT.userProvision), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(provisionBody(session)),
    });
  } catch {
    // 의도한 침묵이다. 이 호출의 실패가 로그인 흐름을 깨면 안 된다 — 트리거가 행 존재는
    // 이미 보장했고, 다음 로그인이 같은 보정을 다시 시도한다. 응답 상태도 같은 이유로
    // 보지 않는다: 실패했을 때 사용자에게 시킬 일이 없다.
  }
}

/** App 이 마운트에서 한 번 건다. 반환값은 구독 해제다. */
export function watchSignInProvision(): () => void {
  let client: ReturnType<typeof getSupabase>;
  try {
    client = getSupabase();
  } catch {
    // 환경 변수가 없으면 클라이언트를 만들 수 없다(.env 없는 CI·테스트). 감시 없이 산다.
    return () => {};
  }

  const { data } = client.auth.onAuthStateChange((event, session) => {
    // 세션은 콜백 인자를 쓴다 — 이 콜백 안에서 auth.getSession() 을 다시 부르면
    // supabase-js 의 내부 잠금과 겹쳐 교착할 수 있다(알려진 제약).
    if (event !== 'SIGNED_IN' || session === null) return;
    void provisionUser(session);
  });
  return () => data.subscription.unsubscribe();
}
