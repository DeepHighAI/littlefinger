import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
