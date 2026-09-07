import type { Locale, Localized } from '@littlefinger/shared';

import { useLocale } from '../lib/locale.tsx';

// 한 화면에는 한 언어만 표시한다 — 접근성 이름도 현재 언어를 따른다(ADR 0021).
const ko = { name: '영어', aria: '영어로 보기' };
const en = { name: 'Korean', aria: 'View in Korean' } satisfies typeof ko;
const LABEL: Localized<typeof ko> = { ko, en };

export function LocaleSwitch(): React.JSX.Element {
  const { locale, setLocale } = useLocale();
  const target: Locale = locale === 'ko' ? 'en' : 'ko';
  return (
    <button
      className="lf-locale-switch"
      type="button"
      data-testid="locale-switch"
      aria-label={LABEL[locale].aria}
      onClick={() => setLocale(target)}
    >
      {LABEL[locale].name}
    </button>
  );
}
