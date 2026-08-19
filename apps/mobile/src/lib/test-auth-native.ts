import { ENDPOINT } from '@littlefinger/shared';

import {
  getMobileFunctionUrl,
  getMobileSupabaseClient,
} from './supabase-native.ts';
import {
  signInWithTestAccount as signInWithTestAccountWithDeps,
} from './test-auth.ts';

/** 테스트 빌드 전용 — SCR-A01 의 `__DEV__` 섹션만 부른다. */
export function signInWithTestAccount(email: string, password: string): Promise<void> {
  const client = getMobileSupabaseClient();
  return signInWithTestAccountWithDeps(email, password, {
    auth: {
      signInWithPassword: (input) => client.auth.signInWithPassword(input),
    },
    fetch: (input, init) => globalThis.fetch(input, init),
    functionUrl: getMobileFunctionUrl(ENDPOINT.userProvision),
  });
}
