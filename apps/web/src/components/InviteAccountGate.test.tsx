// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

import { InviteAccountGate } from './InviteAccountGate.tsx';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(), signOut: vi.fn(), single: vi.fn(),
  listener: null as null | ((event: string, session: Session | null) => void),
}));
vi.mock('../lib/supabase.ts', () => ({
  getSupabase: () => ({
    auth: {
      getSession: auth.getSession, signOut: auth.signOut,
      onAuthStateChange: (listener: typeof auth.listener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ single: auth.single }) }) }),
  }),
}));
function session(id = 'google-user', provider = 'google'): Session {
  return { user: { id, app_metadata: { provider }, user_metadata: { name: 'private@example.com' } } } as unknown as Session;
}
beforeEach(() => {
  auth.getSession.mockReset().mockResolvedValue({ data: { session: session() }, error: null });
  auth.single.mockReset().mockResolvedValue({ data: { nickname: '내 별명' }, error: null });
  auth.signOut.mockReset().mockImplementation(async () => {
    auth.listener?.('SIGNED_OUT', null);
    return { error: null };
  });
});
afterEach(cleanup);
function show(): void {
  render(<MemoryRouter initialEntries={['/i/example/review']}>
    <InviteAccountGate><button>승인하기</button></InviteAccountGate>
  </MemoryRouter>);
}

describe('초대 계정 확인', () => {
  test('기존 세션도 별명과 제공자를 확인하기 전에는 수락 화면을 열지 않는다', async () => {
    show();
    expect(await screen.findByText('내 별명')).toBeTruthy();
    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.queryByText('private@example.com')).toBeNull();
    expect(screen.queryByText('승인하기')).toBeNull();
    fireEvent.click(screen.getByText('이 계정으로 계속하기'));
    expect(screen.getByText('승인하기')).toBeTruthy();
  });
  test('다른 계정 로그인은 로컬 세션을 종료하고 새 계정의 확인을 요구한다', async () => {
    show();
    await screen.findByText('내 별명');
    fireEvent.click(screen.getByText('다른 계정으로 로그인'));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    await act(async () => auth.listener?.('SIGNED_IN', session('kakao-user', 'kakao')));
    expect(await screen.findByText('카카오')).toBeTruthy();
    expect(screen.queryByText('승인하기')).toBeNull();
  });
  test('확인 뒤 세션 사용자가 바뀌면 새 계정을 다시 확인한다', async () => {
    show();
    await screen.findByText('내 별명');
    fireEvent.click(screen.getByText('이 계정으로 계속하기'));
    await act(async () => auth.listener?.('SIGNED_IN', session('second-google')));
    expect(await screen.findByText('이 계정으로 계속하기')).toBeTruthy();
    expect(screen.queryByText('승인하기')).toBeNull();
  });
  test('저장 세션의 늦은 응답이 새 로그인 계정을 덮어쓰지 않는다', async () => {
    let settle: ((value: unknown) => void) | undefined;
    auth.getSession.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    show();
    await act(async () => auth.listener?.('SIGNED_IN', session('new-user', 'kakao')));
    await act(async () => settle?.({ data: { session: session() }, error: null }));
    expect(await screen.findByText('카카오')).toBeTruthy();
    expect(screen.queryByText('Google')).toBeNull();
  });
});
