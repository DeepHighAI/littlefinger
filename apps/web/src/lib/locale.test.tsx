// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider, useLabels, useLocale } from './locale.tsx';

import type { Localized } from '@littlefinger/shared';

const CATALOG: Localized<{ greeting: string }> = {
  ko: { greeting: '안녕하세요' },
  en: { greeting: 'Hello' },
};

function Consumer(): React.JSX.Element {
  const labels = useLabels(CATALOG);
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale('en')}>
      {labels.greeting}
    </button>
  );
}

describe('LocaleProvider (web)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('영어 브라우저는 영어로 시작하고 문서 lang 도 영어다', () => {
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
  });

  it('한국어 브라우저는 한국어로 시작한다', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ko-KR']);
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    expect(screen.getByText('안녕하세요')).toBeTruthy();
    expect(document.documentElement.lang).toBe('ko');
  });

  it('수동 전환은 즉시 반영·저장되고 문서 lang 도 따라간다', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ko-KR']);
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByText('안녕하세요'));
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(window.localStorage.getItem('littlefinger.locale.v1')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('저장된 수동 전환이 브라우저 언어를 이기고 첫 렌더부터 적용된다', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ko-KR']);
    window.localStorage.setItem('littlefinger.locale.v1', 'en');
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    expect(screen.getByText('Hello')).toBeTruthy();
  });
});
