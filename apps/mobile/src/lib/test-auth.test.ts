import type { Session, User } from '@supabase/supabase-js';

import { signInWithTestAccount, type TestAuthDeps } from './test-auth.ts';

const FUNCTION_URL = 'https://test-project.supabase.co/functions/v1/user-provision';

function sessionOf(accessToken: string): Session {
  return { access_token: accessToken, user: { user_metadata: {} } as User } as Session;
}

function depsOf(overrides: {
  session?: Session | null;
  signInError?: Error | null;
  fetchImpl?: TestAuthDeps['fetch'];
}): { deps: TestAuthDeps; calls: { fetch: Array<[string, RequestInit]> } } {
  const calls: { fetch: Array<[string, RequestInit]> } = { fetch: [] };
  const deps: TestAuthDeps = {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({
        data: {
          session: overrides.session === undefined ? sessionOf('token-1') : overrides.session,
          user: null,
        },
        error: overrides.signInError ?? null,
      }),
    },
    fetch:
      overrides.fetchImpl ??
      ((input, init) => {
        calls.fetch.push([input, init]);
        return Promise.resolve(new Response(null, { status: 200 }));
      }),
    functionUrl: FUNCTION_URL,
  };
  return { deps, calls };
}

describe('signInWithTestAccount', () => {
  it('로그인 성공 후 user-provision 을 Bearer 토큰으로 부른다 — 닉네임은 보내지 않는다', async () => {
    const { deps, calls } = depsOf({ session: sessionOf('token-abc') });

    await signInWithTestAccount('tester-a@example.com', 'pw', deps);

    expect(deps.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'tester-a@example.com',
      password: 'pw',
    });
    expect(calls.fetch).toHaveLength(1);
    const [url, init] = calls.fetch[0]!;
    expect(url).toBe(FUNCTION_URL);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token-abc');
    expect(init.body).toBe('{}');
  });

  it('비밀번호 오류는 그대로 던진다', async () => {
    const { deps } = depsOf({ signInError: new Error('Invalid login credentials') });

    await expect(signInWithTestAccount('a@b.c', 'wrong', deps)).rejects.toThrow(
      'Invalid login credentials',
    );
  });

  it('세션이 비면 오류를 던진다', async () => {
    const { deps } = depsOf({ session: null });

    await expect(signInWithTestAccount('a@b.c', 'pw', deps)).rejects.toThrow(
      'Supabase session is missing.',
    );
  });

  it('프로비저닝 실패는 삼킨다 — 세션은 이미 저장됐다', async () => {
    const { deps } = depsOf({
      fetchImpl: () => Promise.reject(new Error('network down')),
    });

    await expect(signInWithTestAccount('a@b.c', 'pw', deps)).resolves.toBeUndefined();
  });
});
