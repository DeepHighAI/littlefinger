import { getSupabase } from './supabase.ts';

/**
 * 수락 웹의 카카오 OAuth 시작점.
 *
 * 초대 흐름과 계정 기반 재접근이 같은 규칙으로 복귀해야 한다. 호출자는 돌아올 **경로**만
 * 정하고, origin 결합과 Supabase 옵션은 여기서 한 번만 관리한다.
 */
export async function signInWithKakao(
  redirectPath: string,
): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}${redirectPath}`,
      queryParams: { prompt: /KAKAOTALK/iu.test(window.navigator.userAgent) ? 'select_account' : 'login' },
    },
  });
  if (error) throw error;
}

/**
 * Google OAuth 시작점 — 리다이렉트·세션 감지·프로비저닝 경로 전부 카카오와 같다.
 * 계정 전환 버튼을 누르면 제공자에서도 계정을 다시 선택할 수 있어야 한다.
 */
export async function signInWithGoogle(redirectPath: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${redirectPath}`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

/**
 * 테스트 전용 이메일 로그인 — dev 서버에서만 노출되는 `TestLoginForm` 이 부른다.
 * `vite build` 산출물에서는 호출부가 제거되므로 배포 웹에는 이 경로가 없다.
 * 프로비저닝은 카카오와 동일하게 `watchSignInProvision` 이 SIGNED_IN 에서 처리한다.
 */
export async function signInWithTestAccount(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}
