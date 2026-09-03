// @vitest-environment jsdom
import { PLAY_STORE_BASE_URL } from '@littlefinger/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { Home } from './home.tsx';

afterEach(cleanup);

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe('공개 홈', () => {
  it('로그인 없이 앱 이름과 목적을 설명한다 — OAuth 브랜드 인증의 홈페이지 검사 조건', () => {
    const { container } = renderPage();

    // 동의 화면의 앱 이름(리틀핑거)과 같은 이름이 홈페이지에 있어야 한다.
    expect(screen.getByRole('heading', { level: 1, name: '리틀핑거' })).toBeTruthy();
    expect(screen.getByText(/상호 약속 관리 서비스/u)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: '이렇게 사용해요' })).toBeTruthy();
    // 로그인 화면이 먼저 보이면 안 된다 — 로그인 컨트롤 자체가 없다.
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('ins, iframe, .lf-ad')).toBeNull();
  });

  it('스토어·법무 문서·계정 삭제로 가는 링크를 건다', () => {
    renderPage();
    expect(
      screen.getByRole('link', { name: 'Google Play에서 받기' }).getAttribute('href'),
    ).toContain(PLAY_STORE_BASE_URL);
    expect(screen.getByRole('link', { name: '개인정보처리방침' }).getAttribute('href')).toBe(
      '/legal/privacy',
    );
    expect(screen.getByRole('link', { name: '이용약관' }).getAttribute('href')).toBe('/legal/terms');
    expect(screen.getByRole('link', { name: '계정 삭제 안내' }).getAttribute('href')).toBe(
      '/account-deletion',
    );
  });
});
