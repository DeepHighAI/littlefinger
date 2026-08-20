import { AUTH_SESSION_RETRY_DELAYS_MS } from '@littlefinger/shared';
import type { Session, User } from '@supabase/supabase-js';

interface OAuthResponse {
  data: { provider: string; url: string | null };
  error: Error | null;
}

interface SetSessionResponse {
  data: { session: Session | null; user: User | null };
  error: Error | null;
}

export type MobileOAuthProvider = 'kakao' | 'google';

export interface MobileAuthClient {
  signInWithOAuth(input: {
    provider: MobileOAuthProvider;
    options: { redirectTo: string; skipBrowserRedirect: true };
  }): Promise<OAuthResponse>;
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<SetSessionResponse>;
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
  sleep(ms: number): Promise<void>;
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
  const accessToken = params['access_token'];
  const refreshToken = params['refresh_token'];
  if (accessToken === undefined || refreshToken === undefined) {
    throw new Error('Kakao OAuth callback tokens are missing.');
  }

  let sessionResult = await deps.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  for (const delayMs of AUTH_SESSION_RETRY_DELAYS_MS) {
    if (sessionResult.error === null) break;
    await deps.sleep(delayMs);
    sessionResult = await deps.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  const { data: sessionData, error: sessionError } = sessionResult;
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
