// @vitest-environment jsdom
import { ENDPOINT, LEGAL_DISCLAIMER } from '@littlefinger/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App.tsx';
import { invitePath, ROUTE } from './routes.ts';

// Testing Library 의 자동 cleanup 은 전역 `afterEach` 가 있을 때만 등록된다. 이 저장소는
// vitest `globals` 를 켜지 않으므로 직접 부른다 — 없으면 렌더가 쌓여 두 번째 테스트부터
// "getByTestId 가 여러 개를 찾았다"로 깨진다.
afterEach(cleanup);

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App 라우팅', () => {
  it('초대 경로가 토큰을 뽑아낸다', () => {
    renderAt('/i/abc123');
    expect(screen.getByTestId('invite-token').textContent).toBe('abc123');
  });

  it('URL-safe Base64 토큰의 - 와 _ 가 살아남는다', () => {
    // 토큰은 32바이트 CSPRNG 의 URL-safe Base64 다. 이 두 글자가 경로에서 깨지면
    // 해시가 달라지고, 증상은 E_NOT_FOUND 하나뿐이라 원인을 좁힐 단서가 없다.
    const token = 'a-b_c-d_e';
    renderAt(invitePath(token));
    expect(screen.getByTestId('invite-token').textContent).toBe(token);
  });

  it('모르는 경로는 SCR-W06 으로 떨어진다', () => {
    renderAt('/nope');
    expect(screen.getByTestId('reason').textContent).toBe('초대 링크를 찾을 수 없습니다.');
  });

  it('packages/shared 를 웹에서 그대로 읽는다', () => {
    // 워크스페이스 링크가 풀리는지 확인하는 것이 목적이다. 이것이 깨지면 화면 작업 첫 줄에서
    // 도메인 계약·라벨·정책 상수가 통째로 사라진다.
    expect(ENDPOINT.invitePreview).toBe('invite-preview');
    expect(LEGAL_DISCLAIMER.length).toBeGreaterThan(0);
  });

  it('경로표가 초대 링크 형태를 고정한다', () => {
    // 이 값이 바뀌면 이미 카카오톡에 뿌려진 링크가 전부 죽는다 — 서버에 발송 URL 기록이 없다.
    expect(ROUTE.invite).toBe('/i/:token');
    expect(invitePath('t')).toBe('/i/t');
  });
});
