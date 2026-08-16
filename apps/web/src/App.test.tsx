// @vitest-environment jsdom
import { ENDPOINT, LEGAL_DISCLAIMER } from '@littlefinger/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.tsx';
import { invitePath, legalPath, promisesPath, ROUTE } from './routes.ts';

// SCR-W01 은 마운트하자마자 invite-resolve 를 부른다. 이 파일은 라우팅만 보므로 응답은
// 영원히 오지 않게 두고, **요청에 실린 토큰**으로 경로 → 화면 연결을 확인한다.
const fetchMock = vi.fn(() => new Promise<Response>(() => {}));

// 로그인 감시는 별도 모듈이 테스트한다(lib/user-provision.test.ts). 여기서는 App 이
// 그것을 **걸고 푸는지**만 본다.
const { watchSignInProvision, unwatch } = vi.hoisted(() => {
  const unwatch = vi.fn();
  return { watchSignInProvision: vi.fn(() => unwatch), unwatch };
});

vi.mock('./lib/user-provision.ts', () => ({ watchSignInProvision }));

// Testing Library 의 자동 cleanup 은 전역 `afterEach` 가 있을 때만 등록된다. 이 저장소는
// vitest `globals` 를 켜지 않으므로 직접 부른다 — 없으면 렌더가 쌓여 두 번째 테스트부터
// "getByTestId 가 여러 개를 찾았다"로 깨진다.
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  watchSignInProvision.mockClear();
  unwatch.mockClear();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/** SCR-W01 이 방금 보낸 요청에서 토큰을 꺼낸다. */
function sentToken(): unknown {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return (JSON.parse(String(init.body)) as { token: unknown }).token;
}

describe('App 라우팅', () => {
  it.each([
    ['TERMS', '이용약관'],
    ['PRIVACY', '개인정보 처리방침'],
  ] as const)('공개 %s 문서를 로그인 없이 연다', (kind, title) => {
    renderAt(legalPath(kind));
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('계정 기반 참여 약속 경로를 직접 연다', async () => {
    renderAt(promisesPath());
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      '참여 중인 약속',
    );
  });

  it('초대 경로가 토큰을 뽑아 SCR-W01 로 넘긴다', () => {
    renderAt('/i/abc123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentToken()).toBe('abc123');
  });

  it('URL-safe Base64 토큰의 - 와 _ 가 살아남는다', () => {
    // 토큰은 32바이트 CSPRNG 의 URL-safe Base64 다. 이 두 글자가 경로에서 깨지면
    // 해시가 달라지고, 증상은 E_NOT_FOUND 하나뿐이라 원인을 좁힐 단서가 없다.
    const token = 'a-b_c-d_e';
    renderAt(invitePath(token));
    expect(sentToken()).toBe(token);
  });

  it('모르는 경로는 SCR-W06 으로 떨어진다', () => {
    renderAt('/nope');
    expect(screen.getByTestId('reason').textContent).toBe('초대 링크를 찾을 수 없습니다.');
    // 토큰이 없으니 함수를 부를 일도 없다.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('packages/shared 를 웹에서 그대로 읽는다', () => {
    // 워크스페이스 링크가 풀리는지 확인하는 것이 목적이다. 이것이 깨지면 화면 작업 첫 줄에서
    // 도메인 계약·라벨·정책 상수가 통째로 사라진다.
    expect(ENDPOINT.invitePreview).toBe('invite-preview');
    expect(LEGAL_DISCLAIMER.length).toBeGreaterThan(0);
  });

  it('마운트 시 로그인 감시를 걸고 언마운트 시 푼다', () => {
    // OAuth 리다이렉트는 어느 화면으로든 돌아올 수 있다(지금은 SCR-W01 뿐이지만).
    // 감시가 화면이 아니라 App 에 있어야 화면이 늘어도 보정 호출이 빠지지 않는다.
    const { unmount } = render(
      <MemoryRouter initialEntries={['/nope']}>
        <App />
      </MemoryRouter>,
    );
    expect(watchSignInProvision).toHaveBeenCalledTimes(1);
    expect(unwatch).not.toHaveBeenCalled();
    unmount();
    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it('경로표가 초대 링크 형태를 고정한다', () => {
    // 이 값이 바뀌면 이미 카카오톡에 뿌려진 링크가 전부 죽는다 — 서버에 발송 URL 기록이 없다.
    expect(ROUTE.invite).toBe('/i/:token');
    expect(invitePath('t')).toBe('/i/t');
  });
});
