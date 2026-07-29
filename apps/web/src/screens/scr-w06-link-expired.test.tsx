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

/**
 * 사용자가 실제로 읽는 글자. aria-hidden 을 떼고 읽으므로, 아이콘이 aria-hidden 을 잃으면
 * 이 함수가 먼저 알려 준다 — 스크린 리더에 아이콘 코드포인트가 새는 것을 막는다.
 */
function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return clone.textContent?.trim() ?? '';
}

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
    const visible = [...container.querySelectorAll('h1, p')].map(visibleText).filter((t) => t);
    expect(visible).toEqual([
      '이 링크는 더 쓸 수 없어요',
      '초대 링크가 만료되었습니다. 상대에게 새 링크를 요청해 주세요.',
      '초대 링크는 1회용이에요',
    ]);
  });

  it('아이콘은 리가처가 아니라 코드포인트를 쓴다', () => {
    // 리가처를 쓰면 폰트 서브셋이 사실상 불가능하고(실측 5220 KB → 4655 KB), 폰트가 늦게
    // 오면 링크가 끊겼다고 알려 주는 화면에 'link_off' 라는 낱말이 그대로 보인다.
    const { container } = render(<ScrW06LinkExpired reason="E_INVITE_EXPIRED" />);
    const icons = [...container.querySelectorAll('.material-symbols-rounded')];
    expect(icons.length).toBe(2);
    for (const icon of icons) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.textContent).not.toMatch(/[a-z_]/);
      expect(icon.textContent?.codePointAt(0)).toBeGreaterThanOrEqual(0xe000);
    }
  });

  it('광고 슬롯이 없다', () => {
    // CLAUDE.md §8-1 — 수락 웹 전체에 광고가 없다. 유일한 슬롯은 SCR-A02 하단뿐이다.
    //
    // `[class*="ad"]` 로 쓰면 안 된다. 부분 문자열이라 `lf-pinky-b**ad**ge` 와
    // `lf-he**ad**line` 이 걸린다 — 실제로 SCR-W01 에서 광고 2개로 잡혔다.
    const { container } = render(<ScrW06LinkExpired reason="E_BLOCKED" />);
    expect(container.querySelector('[class*="lf-ad"]')).toBeNull();
  });
});
