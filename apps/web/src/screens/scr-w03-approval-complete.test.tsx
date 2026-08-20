// @vitest-environment jsdom
import { LEGAL_DISCLAIMER } from '@littlefinger/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { approvalCompletePath, invitePath, promisesPath, ROUTE } from '../routes.ts';
import { ScrW03ApprovalComplete } from './scr-w03-approval-complete.tsx';

const TOKEN = 'a-b_c-d_e';

// 승인 응답(§4-3-5). 두 시각은 UTC 로 오고 화면은 KST 로 그린다.
// 12:04Z = 21:04 KST, 11:58Z = 20:58 KST — 레퍼런스 HTML 과 같은 예시다.
const RESULT = {
  promise_id: '11111111-1111-4111-8111-111111111111',
  status: 'ACTIVE' as const,
  activated_at: '2026-07-12T12:04:00.000Z',
  creator_id: '22222222-2222-4222-8222-222222222222',
  title: '매주 화·목 아침 러닝 같이 하기',
  partner: { user_id: '33333333-3333-4333-8333-333333333333', nickname: '민준', profile_image_url: null },
  version_no: 1,
  fingerprint: 'A3F9-77C2-01',
  approvals: [
    { role: 'CREATOR' as const, nickname: '지우', acted_at: '2026-07-11T05:20:00.000Z' },
    { role: 'PARTNER' as const, nickname: '민준', acted_at: '2026-07-12T12:04:00.000Z' },
  ],
};

function renderWith(state: unknown): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[{ pathname: approvalCompletePath(TOKEN), state }]}>
      <Routes>
        <Route path={ROUTE.approvalComplete} element={<ScrW03ApprovalComplete />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 사용자가 실제로 읽는 글자. 아이콘은 코드포인트 한 글자라 그대로 두면 문자열에 섞인다. */
function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return clone.textContent ?? '';
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SCR-W03 승인 완료', () => {
  it('확정 영역도 동일한 브랜드 이미지 심볼을 쓴다', () => {
    renderWith(RESULT);
    const mark = screen.getByRole('img', { name: '새끼손가락 걸기' });

    expect(mark.tagName).toBe('IMG');
    expect(mark.getAttribute('src')).toContain('brand-symbol');
  });

  it('확정 스탬프에 확정 시각을 KST 로 적는다', () => {
    renderWith(RESULT);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('확정된 약속');
    // EC-F09 — 기기 타임존이 KST 가 아니어도 이 값은 바뀌지 않는다.
    expect(screen.getByTestId('confirmed-at').textContent).toBe('2026-07-12 21:04 (KST) 확정');
  });

  it('양측 승인 로그가 날짜까지 다 있다', () => {
    // §4-3-6 — 작성자의 승인 시각은 **초대 발송 시각**이라 상대방의 것과 날짜가 다르다.
    // 시각만 적으면 하루 이상 벌어진 두 승인이 같은 날처럼 보인다.
    renderWith(RESULT);
    const rows = screen.getAllByTestId('approval-row').map(visibleText);
    expect(rows).toEqual([
      '지우(작성자) 승인 2026-07-11 14:20 (KST)',
      '민준(상대방) 승인 2026-07-12 21:04 (KST)',
    ]);
  });

  it('기록 지문과 디스클레이머가 있다', () => {
    const { container } = renderWith(RESULT);
    expect(screen.getByTestId('fingerprint').textContent).toBe('A3F9-77C2-01');
    // CLAUDE.md §8-2 — 4곳 중 하나. 상수 그대로여야 한다.
    expect(container.querySelector('.lf-disclaimer')?.textContent).toBe(LEGAL_DISCLAIMER);
  });

  it('계정 기반 재접근 안내와 참여 약속 링크가 있다', () => {
    renderWith(RESULT);
    expect(
      screen.getByText('이 약속은 로그인하면 언제든 다시 볼 수 있어요'),
    ).toBeTruthy();
    const link = screen.getByRole('link', { name: '참여 중인 약속 보기' });
    expect(link.getAttribute('href')).toBe(promisesPath());
    expect(screen.getByTestId('fingerprint').textContent).toBe('A3F9-77C2-01');
  });

  it('이메일 입력·버전 이력은 만들지 않고 Android 앱 설치 배너를 보여준다', () => {
    const { container } = renderWith(RESULT);
    expect(container.querySelector('input')).toBeNull();
    expect(screen.queryByText('버전 이력 보기')).toBeNull();
    expect(container.querySelector('.lf-app-hint')).not.toBeNull();
    const link = screen.getByRole('link', { name: 'Android 앱 설치하기' });
    expect(link.getAttribute('href')).toContain('play.google.com/store/apps/details?id=com.littlefinger.app');
  });

  it('EC-I03 iOS에서는 앱 설치 배너를 숨기고 웹 재접근만 제공한다', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    const { container } = renderWith(RESULT);
    expect(container.querySelector('.lf-app-hint')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Android 앱 설치하기' })).toBeNull();
    expect(screen.getByRole('link', { name: '참여 중인 약속 보기' })).toBeTruthy();
  });

  it('state 가 없어도 계정 기반 재접근 출구는 남는다', () => {
    // 새로고침으로 일회성 승인 payload는 사라져도 SCR-W04는 서버 상태로 복원한다.
    renderWith(undefined);
    expect(screen.getByTestId('no-result')).toBeTruthy();
    expect(screen.queryByTestId('fingerprint')).toBeNull();
    expect(screen.getByRole('link', { name: '참여 중인 약속 보기' })).toBeTruthy();
  });

  it('승인 로그가 한 행뿐이면 확정 화면을 그리지 않는다', () => {
    // §4-3-5 5단계는 **2행**을 남긴다. 한쪽만 그리면 "양측 승인"이 거짓말이 된다.
    renderWith({ ...RESULT, approvals: [RESULT.approvals[0]] });
    expect(screen.getByTestId('no-result')).toBeTruthy();
  });

  it('완료 경로는 초대 경로 아래에 있다', () => {
    expect(approvalCompletePath(TOKEN)).toBe(`${invitePath(TOKEN)}/done`);
  });
});
