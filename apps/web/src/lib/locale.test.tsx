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

  it('감지가 꺼진 동안은 영어 브라우저에서도 한국어가 기본이다', () => {
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    expect(screen.getByText('안녕하세요')).toBeTruthy();
    expect(document.documentElement.lang).toBe('ko');
  });

  it('수동 전환은 즉시 반영·저장되고 문서 lang 도 따라간다', () => {
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

  it('저장된 수동 전환이 첫 렌더부터 이긴다', () => {
    window.localStorage.setItem('littlefinger.locale.v1', 'en');
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    expect(screen.getByText('Hello')).toBeTruthy();
  });
});
