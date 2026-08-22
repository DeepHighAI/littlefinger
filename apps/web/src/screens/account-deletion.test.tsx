// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AccountDeletion } from './account-deletion.tsx';

afterEach(cleanup);

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <AccountDeletion />
    </MemoryRouter>,
  );
}

describe('계정 삭제 안내', () => {
  it('인앱 절차·이메일 접수 채널·보존 안내를 인증 없이 보여준다', () => {
    const { container } = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: '계정 삭제 안내' })).toBeTruthy();
    for (const heading of ['앱에서 직접 삭제', '앱을 사용할 수 없는 경우', '삭제되는 정보와 남는 정보']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    }
    // Play 데이터 보안 양식이 요구하는 오프앱 접수 채널.
    expect(screen.getByText(/task@deephigh\.ai/u)).toBeTruthy();
    // 확정 기록 비식별 보존은 방침과 같은 사실을 말해야 한다.
    expect(screen.getByText(/식별할 수 없는 상태로 남을 수 있습니다/u)).toBeTruthy();
    expect(container.querySelector('ins, iframe, .lf-ad')).toBeNull();
  });

  it('개인정보 처리방침으로 가는 링크를 건다', () => {
    renderPage();
    expect(screen.getByRole('link', { name: '개인정보 처리방침 보기' }).getAttribute('href')).toBe(
      '/legal/privacy',
    );
  });
});
