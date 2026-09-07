// @vitest-environment jsdom
import { LOCALE_STORAGE_KEY } from '@littlefinger/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '../lib/locale.tsx';
import { LocaleSwitch } from './LocaleSwitch.tsx';

/**
 * 언어 전환의 세 계약: 버튼 문구는 전환될 언어의 이름이고, 누르면 html lang 이 따라
 * 바뀌고, 선택은 localStorage 에 남아 다음 방문에서도 이긴다.
 */

function renderSwitch(): void {
  render(
    <LocaleProvider>
      <LocaleSwitch />
    </LocaleProvider>,
  );
}

describe('LocaleSwitch', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom 기본 브라우저 언어는 en-US 다 — 감지가 켜진 지금은 명시해야 ko 로 시작한다.
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ko-KR']);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('언어 전환 버튼의 문구와 접근성 이름은 현재 언어를 따른다', () => {
    renderSwitch();
    const button = screen.getByTestId('locale-switch');
    expect(button.textContent).toBe('영어');
    expect(button.getAttribute('aria-label')).toBe('영어로 보기');

    fireEvent.click(button);
    expect(button.textContent).toBe('Korean');
    expect(button.getAttribute('aria-label')).toBe('View in Korean');
    expect(document.documentElement.lang).toBe('en');

    fireEvent.click(button);
    expect(button.textContent).toBe('영어');
    expect(document.documentElement.lang).toBe('ko');
  });

  it('전환은 localStorage 에 저장되어 다음 마운트의 초기 로케일을 정한다', () => {
    renderSwitch();
    fireEvent.click(screen.getByTestId('locale-switch'));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');

    cleanup();
    renderSwitch();
    // 저장된 en 이 초기값 — 버튼은 되돌아갈 한국어를 보여 준다.
    expect(screen.getByTestId('locale-switch').textContent).toBe('Korean');
    expect(document.documentElement.lang).toBe('en');
  });
});
