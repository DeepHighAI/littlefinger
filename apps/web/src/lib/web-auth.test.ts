// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const { signInWithOAuth, signInWithPassword } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock('./supabase.ts', () => ({
  getSupabase: () => ({ auth: { signInWithOAuth, signInWithPassword } }),
}));

import { signInWithGoogle, signInWithKakao, signInWithTestAccount } from './web-auth.ts';

afterEach(() => {
  signInWithOAuth.mockReset();
  signInWithPassword.mockReset();
});

describe('웹 카카오 로그인', () => {
  it('요청한 웹 경로로 정확히 돌아온다', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    await signInWithKakao('/promises');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/promises` },
    });
  });

  it('Supabase OAuth 실패를 호출자에게 돌려준다', async () => {
    const failure = new Error('provider unavailable');
    signInWithOAuth.mockResolvedValue({ data: {}, error: failure });

    await expect(signInWithKakao('/promises')).rejects.toBe(failure);
  });
});

describe('웹 Google 로그인', () => {
  it('요청한 웹 경로로 정확히 돌아온다 — 카카오와 같은 규칙', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    await signInWithGoogle('/promises');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/promises` },
    });
  });

  it('Supabase OAuth 실패를 호출자에게 돌려준다', async () => {
    const failure = new Error('provider unavailable');
    signInWithOAuth.mockResolvedValue({ data: {}, error: failure });

    await expect(signInWithGoogle('/promises')).rejects.toBe(failure);
  });
});

describe('웹 테스트 로그인 (dev 전용)', () => {
  it('이메일과 비밀번호로 로그인한다 — 프로비저닝은 watchSignInProvision 몫이다', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: null });

    await signInWithTestAccount('tester-b@example.com', 'pw');

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'tester-b@example.com',
      password: 'pw',
    });
  });

  it('로그인 실패를 호출자에게 돌려준다', async () => {
    const failure = new Error('Invalid login credentials');
    signInWithPassword.mockResolvedValue({ data: {}, error: failure });

    await expect(signInWithTestAccount('a@b.c', 'wrong')).rejects.toBe(failure);
  });
});
