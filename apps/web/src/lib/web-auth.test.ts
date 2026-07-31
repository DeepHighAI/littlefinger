// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const { signInWithOAuth } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
}));

vi.mock('./supabase.ts', () => ({
  getSupabase: () => ({ auth: { signInWithOAuth } }),
}));

import { signInWithKakao } from './web-auth.ts';

afterEach(() => {
  signInWithOAuth.mockReset();
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
