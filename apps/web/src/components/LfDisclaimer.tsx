import { LEGAL_DISCLAIMER_BY_LOCALE } from '@littlefinger/shared';

import { useLocale } from '../lib/locale.tsx';

/**
 * 법적 고지 — 로케일별 확정 상수를 그대로 렌더한다.
 *
 * **문구를 props 로 받지 않는다**(CLAUDE.md §8-2, 04 §12-2). 받는 순간 화면마다 다른
 * 문장이 가능해지고, ko 는 상위기획서 §10 이 확정한 변경 금지 원문이다.
 * en 은 법무 검토 전 초안(PO 2026-08-20) — 검토 결과로만 바뀐다.
 * 접기(collapse) 처리도 하지 않는다(§4-4-3).
 *
 * 노출 5곳 중 수락 웹은 SCR-W02(검토)와 SCR-W03(승인 완료) 둘이다.
 */
export function LfDisclaimer(): React.JSX.Element {
  const { locale } = useLocale();
  return <p className="lf-disclaimer">{LEGAL_DISCLAIMER_BY_LOCALE[locale]}</p>;
}
