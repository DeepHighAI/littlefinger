// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ScrW06LinkExpired, type LinkUnavailableReason } from './scr-w06-link-expired.tsx';

afterEach(cleanup);

// `02` §10 원문. 여기가 틀어지면 화면이 사용자에게 잘못된 원인을 알려 준다.
const EXPECTED: Record<LinkUnavailableReason, string> = {
  E_INVITE_EXPIRED: '초대 링크가 만료되었습니다. 상대에게 새 링크를 요청해 주세요.',
  E_INVITE_USED: '이미 사용된 초대입니다.',
  E_INVITE_REVOKED: '이 초대는 취소되었습니다.',
  E_BLOCKED: '이 초대는 열 수 없습니다.',
  E_NOT_FOUND: '초대 링크를 찾을 수 없습니다.',
};

describe('SCR-W06 링크 무효·만료 안내', () => {
  it.each(Object.entries(EXPECTED))('%s 는 사유별 문구를 그대로 쓴다', (reason, body) => {
    render(<ScrW06LinkExpired reason={reason as LinkUnavailableReason} />);
    expect(screen.getByTestId('reason').textContent).toBe(body);
  });

  it('1회용 안내는 만료·사용됨에만 붙는다', () => {
    // 취소·차단·없음은 링크를 다시 받아도 열리지 않는다. 여기에 "1회용이에요"를 붙이면
    // 원인을 잘못 짚어 준다.
    for (const reason of ['E_INVITE_EXPIRED', 'E_INVITE_USED'] as const) {
      render(<ScrW06LinkExpired reason={reason} />);
      expect(screen.getByText('초대 링크는 1회용이에요')).toBeTruthy();
      cleanup();
    }
    for (const reason of ['E_INVITE_REVOKED', 'E_BLOCKED', 'E_NOT_FOUND'] as const) {
      render(<ScrW06LinkExpired reason={reason} />);
      expect(screen.queryByText('초대 링크는 1회용이에요')).toBeNull();
      cleanup();
    }
  });

  it('약속 내용도 CTA 도 담지 않는다', () => {
    // EC-B01·EC-B11 이 "약속 내용 일절 노출 금지"다. 이 화면은 사유만 말하고,
    // §4-3-3 대로 주 CTA 가 없다 — 사용자가 여기서 할 수 있는 일이 없다.
    const { container } = render(<ScrW06LinkExpired reason="E_INVITE_EXPIRED" />);
    for (const contentClass of ['.lf-screen__actions', '.lf-card', '.lf-fingerprint', '.lf-btn']) {
      expect(container.querySelector(contentClass)).toBeNull();
    }
    // 보이는 글자는 제목·사유·안내 셋뿐이다. 아이콘 span 은 aria-hidden 이라 세지 않는다.
    const visible = [...container.querySelectorAll('h1, p')]
      .map((el) => el.textContent?.replace(/link_off|info/g, '').trim())
      .filter((t) => t);
    expect(visible).toEqual([
      '이 링크는 더 쓸 수 없어요',
      '초대 링크가 만료되었습니다. 상대에게 새 링크를 요청해 주세요.',
      '초대 링크는 1회용이에요',
    ]);
  });

  it('광고 슬롯이 없다', () => {
    // CLAUDE.md §8-1 — 수락 웹 전체에 광고가 없다.
    const { container } = render(<ScrW06LinkExpired reason="E_BLOCKED" />);
    expect(container.querySelector('[class*="ad"]')).toBeNull();
  });
});
