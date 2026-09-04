import type { Session, User } from '@supabase/supabase-js';

interface OAuthResponse {
  data: { provider: string; url: string | null };
  error: Error | null;
}

interface AuthSessionResponse {
  data: { session: Session | null; user: User | null };
  error: Error | null;
}

export type MobileOAuthProvider = 'kakao' | 'google';

export interface MobileAuthClient {
  signInWithOAuth(input: {
    provider: MobileOAuthProvider;
    options: { redirectTo: string; skipBrowserRedirect: true };
  }): Promise<OAuthResponse>;
  exchangeCodeForSession(code: string): Promise<AuthSessionResponse>;
}

export interface KakaoAuthDeps {
  auth: MobileAuthClient;
  fetch(input: string, init: RequestInit): Promise<Response>;
  functionUrl: string;
  openAuthSession(
    url: string,
    redirectTo: string,
  ): Promise<{ type: string; url?: string }>;
  parseUrl(url: string): {
    params: Record<string, string | undefined>;
    errorCode: string | null;
  };
  redirectTo: string;
}

export type KakaoSignInResult = 'SIGNED_IN' | 'CANCELED' | 'NICKNAME_REQUIRED';

export async function completeKakaoSignIn(
  url: string,
  deps: KakaoAuthDeps,
): Promise<KakaoSignInResult> {
  const { params, errorCode } = deps.parseUrl(url);
  if (errorCode !== null) {
    const description = params['error_description'] ?? '';
    if (errorCode === 'access_denied' && /profile_nickname/iu.test(description)) {
      return 'NICKNAME_REQUIRED';
    }
    throw new Error(errorCode);
  }
  // PKCE 콜백은 토큰이 아니라 1회용 code 만 싣고 온다. 가로챈 쪽은 code_verifier 가 없어
  // 교환에 실패하고, 우리 쪽은 프로세스가 죽었다 살아나도 저장소의 verifier 로 이어받는다.
  const code = params['code'];
  if (code === undefined) {
    throw new Error('OAuth callback code is missing.');
  }

  // 재시도하지 않는다. auth-js 는 교환이 실패하면 code_verifier 를 지우므로(EC-A02 의
  // 1·2·4초 재시도는 setSession 시절 이야기다) 두 번째 호출은 반드시 verifier 누락으로
  // 끝나고, 사용자에게는 원인과 다른 오류만 보인다. 실패하면 로그인부터 다시 한다.
  const { data: sessionData, error: sessionError } =
    await deps.auth.exchangeCodeForSession(code);
  if (sessionError !== null) throw sessionError;
  if (sessionData.session === null) throw new Error('Supabase session is missing.');

  const metadata = sessionData.session.user.user_metadata;
  const nickname = metadata['name'];
  const profileImageUrl = metadata['avatar_url'];
  try {
    await deps.fetch(deps.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        ...(typeof nickname === 'string' ? { nickname } : {}),
        ...(typeof profileImageUrl === 'string'
          ? { profile_image_url: profileImageUrl }
          : {}),
      }),
    });
  } catch {
    // 세션은 이미 저장됐다. 보정 실패를 로그인 실패로 보이면 실제 상태와 UI 가 어긋난다.
  }

  return 'SIGNED_IN';
}

async function startOAuthSignIn(
  provider: MobileOAuthProvider,
  deps: KakaoAuthDeps,
): Promise<KakaoSignInResult> {
  const { data: oauth, error: oauthError } = await deps.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: deps.redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (oauthError !== null) throw oauthError;
  if (oauth.url === null) throw new Error(`${provider} OAuth URL is missing.`);

  const browserResult = await deps.openAuthSession(oauth.url, deps.redirectTo);
  if (browserResult.type !== 'success' || browserResult.url === undefined) return 'CANCELED';

  // 콜백 처리(토큰 파싱·세션 저장·프로비저닝)는 프로바이더 중립이다 — NICKNAME_REQUIRED
  // 분기만 카카오 전용 동의 항목(profile_nickname)이라 Google 에서는 절대 나오지 않는다.
  return completeKakaoSignIn(browserResult.url, deps);
}

export async function signInWithKakao(deps: KakaoAuthDeps): Promise<KakaoSignInResult> {
  return startOAuthSignIn('kakao', deps);
}

export async function signInWithGoogle(deps: KakaoAuthDeps): Promise<KakaoSignInResult> {
  return startOAuthSignIn('google', deps);
}
