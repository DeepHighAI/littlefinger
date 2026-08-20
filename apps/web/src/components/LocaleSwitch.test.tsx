// @vitest-environment jsdom
import { LOCALE_STORAGE_KEY } from '@littlefinger/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
  });
  afterEach(cleanup);

  it('ko 화면에서는 English 를, 누르면 한국어를 보여 준다', () => {
    renderSwitch();
    const button = screen.getByTestId('locale-switch');
    expect(button.textContent).toBe('English');

    fireEvent.click(button);
    expect(button.textContent).toBe('한국어');
    expect(document.documentElement.lang).toBe('en');

    fireEvent.click(button);
    expect(button.textContent).toBe('English');
    expect(document.documentElement.lang).toBe('ko');
  });

  it('전환은 localStorage 에 저장되어 다음 마운트의 초기 로케일을 정한다', () => {
    renderSwitch();
    fireEvent.click(screen.getByTestId('locale-switch'));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');

    cleanup();
    renderSwitch();
    // 저장된 en 이 초기값 — 버튼은 되돌아갈 한국어를 보여 준다.
    expect(screen.getByTestId('locale-switch').textContent).toBe('한국어');
    expect(document.documentElement.lang).toBe('en');
  });
});
