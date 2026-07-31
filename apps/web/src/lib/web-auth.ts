import { getSupabase } from './supabase.ts';

/**
 * 수락 웹의 카카오 OAuth 시작점.
 *
 * 초대 흐름과 계정 기반 재접근이 같은 규칙으로 복귀해야 한다. 호출자는 돌아올 **경로**만
 * 정하고, origin 결합과 Supabase 옵션은 여기서 한 번만 관리한다.
 */
export async function signInWithKakao(
  redirectPath: string,
  prompt?: 'none',
): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}${redirectPath}`,
      ...(prompt === undefined ? {} : { queryParams: { prompt } }),
    },
  });
  if (error) throw error;
}
