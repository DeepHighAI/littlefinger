import type { Locale } from '@littlefinger/shared';

import { useLocale } from '../lib/locale.tsx';

/**
 * 언어 수동 전환 (PO 2026-08-20: 기기 언어 자동 + 수동 전환).
 *
 * 버튼에는 **전환될 언어의 이름을 그 언어로** 적는다 — 지금 화면 언어를 읽지 못하는
 * 사용자가 자기 언어를 찾는 장치라서, 현재 언어로 번역해 두면 정작 필요한 사람이
 * 못 읽는다. 두 로케일뿐이라 토글 하나면 충분하다. 상태는 색이 아니라 텍스트가
 * 전달한다(CLAUDE.md §8-7).
 */

const LOCALE_NAME: Record<Locale, string> = { ko: '한국어', en: 'English' };

// aria 도 전환될 언어로 적는다 — 이 버튼의 청자는 그 언어의 사용자다.
const SWITCH_ARIA: Record<Locale, string> = {
  ko: '한국어로 보기',
  en: 'View in English',
};

export function LocaleSwitch(): React.JSX.Element {
  const { locale, setLocale } = useLocale();
  const target: Locale = locale === 'ko' ? 'en' : 'ko';
  return (
    <button
      className="lf-locale-switch"
      type="button"
      data-testid="locale-switch"
      aria-label={SWITCH_ARIA[target]}
      onClick={() => setLocale(target)}
    >
      {LOCALE_NAME[target]}
    </button>
  );
}
