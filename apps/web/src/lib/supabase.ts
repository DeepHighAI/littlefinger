import type { Endpoint } from '@littlefinger/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Edge Function 주소.
 *
 * `invite-resolve` 는 `verify_jwt = false` 라 **로그인 전에** 불린다. supabase-js 의
 * `functions.invoke` 를 쓰지 않는 이유가 여기 있다 — 그쪽은 `apikey` 와 `Authorization`
 * 을 언제나 싣는데, 함수가 요구하지 않는 열쇠를 로그인 전 화면이 내밀 이유가 없다.
 * 실패도 `FunctionsHttpError` 로 감싸여 §2-3 코드를 꺼내려면 한 겹을 더 벗겨야 한다.
 */
export function functionUrl(slug: Endpoint): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error('VITE_SUPABASE_URL 이 필요하다.');
  }
  // 끝의 슬래시를 지운다. `.env` 에 `https://x.supabase.co/` 로 들어오면 `//functions` 가 되고,
  // 증상은 404 하나뿐이라 함수가 배포되지 않은 것과 구분되지 않는다.
  return `${url.replace(/\/+$/, '')}/functions/v1/${slug}`;
}

// 웹은 **anon 키만** 싣는다(§9). service_role 은 Edge Function 안에만 있다.
// anon 키는 공개되도록 설계된 키이고, 데이터를 지키는 것은 RLS 다.
//
// 모듈 최상단에서 만들지 않는 이유: `.env` 는 gitignore 라 CI 와 테스트에는 없다.
// 최상단에서 던지면 이 모듈을 **import 만 해도** 무관한 테스트가 죽는다.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 가 필요하다.');
  }

  client = createClient(url, anonKey, {
    auth: {
      // 카카오 로그인은 리다이렉트로 돌아온 URL 의 조각(fragment)에 세션을 싣고 온다.
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
    },
  });

  return client;
}
