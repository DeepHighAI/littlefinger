// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { signInWithTestAccount } = vi.hoisted(() => ({
  signInWithTestAccount: vi.fn(),
}));

vi.mock('../lib/web-auth.ts', () => ({ signInWithTestAccount }));

import { TestLoginForm } from './test-login-form.tsx';

/** dev 서버 조건을 흉내낸다 — 이 폼은 MODE=development 에서만 그려진다. */
function stubDevServer(): void {
  vi.stubEnv('MODE', 'development');
}

afterEach(() => {
  cleanup();
  signInWithTestAccount.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('TestLoginForm', () => {
  it('테스트 모드(기본)에서는 렌더되지 않는다 — 화면 테스트가 제품 화면만 보게', () => {
    const { container } = render(<TestLoginForm />);
    expect(container.innerHTML).toBe('');
  });

  it('다듬은 이메일과 비밀번호로 로그인하고 새로고침한다', async () => {
    stubDevServer();
    signInWithTestAccount.mockResolvedValue(undefined);
    // jsdom 의 location.reload 는 구현이 없어 스파이로 바꾼다.
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    render(<TestLoginForm />);
    fireEvent.change(screen.getByLabelText('테스트 이메일'), {
      target: { value: '  tester-b@example.com  ' },
    });
    fireEvent.change(screen.getByLabelText('테스트 비밀번호'), {
      target: { value: 'secret-pw' },
    });
    fireEvent.click(screen.getByRole('button', { name: '테스트 계정으로 로그인' }));

    await waitFor(() => {
      expect(signInWithTestAccount).toHaveBeenCalledWith('tester-b@example.com', 'secret-pw');
      expect(reload).toHaveBeenCalled();
    });
  });

  it('로그인 실패는 오류 문구로 보여주고 새로고침하지 않는다', async () => {
    stubDevServer();
    signInWithTestAccount.mockRejectedValue(new Error('Invalid login credentials'));

    render(<TestLoginForm />);
    fireEvent.change(screen.getByLabelText('테스트 이메일'), {
      target: { value: 'tester-b@example.com' },
    });
    fireEvent.change(screen.getByLabelText('테스트 비밀번호'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: '테스트 계정으로 로그인' }));

    expect(
      await screen.findByText('테스트 로그인에 실패했습니다. 계정 정보를 확인해 주세요.'),
    ).toBeTruthy();
  });
});
