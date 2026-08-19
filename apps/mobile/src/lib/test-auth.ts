import type { Session, User } from '@supabase/supabase-js';

interface PasswordSessionResponse {
  data: { session: Session | null; user: User | null };
  error: Error | null;
}

export interface TestAuthDeps {
  auth: {
    signInWithPassword(input: {
      email: string;
      password: string;
    }): Promise<PasswordSessionResponse>;
  };
  fetch(input: string, init: RequestInit): Promise<Response>;
  functionUrl: string;
}

/**
 * 테스트 빌드 전용 이메일 로그인. 호출부가 `__DEV__` 게이트를 지므로
 * 릴리스 번들에는 이 경로로 들어오는 UI 가 없다.
 *
 * 카카오 경로와 달리 브라우저 왕복이 없어 setSession 재시도가 필요 없다.
 * 닉네임은 보내지 않는다 — 이메일 계정에는 카카오 프로필이 없으므로,
 * 닉네임 미보유 사용자의 실제 흐름(프로필에서 입력)을 그대로 타게 한다.
 */
export async function signInWithTestAccount(
  email: string,
  password: string,
  deps: TestAuthDeps,
): Promise<void> {
  const { data, error } = await deps.auth.signInWithPassword({ email, password });
  if (error !== null) throw error;
  if (data.session === null) throw new Error('Supabase session is missing.');

  try {
    await deps.fetch(deps.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({}),
    });
  } catch {
    // 세션은 이미 저장됐다. 보정 실패를 로그인 실패로 보이면 실제 상태와 UI 가 어긋난다.
  }
}
