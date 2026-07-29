import { LEGAL_DISCLAIMER } from '@littlefinger/shared';

/**
 * 법적 고지 — 상수를 그대로 렌더한다.
 *
 * **문구를 props 로 받지 않는다**(CLAUDE.md §8-2, 04 §12-2). 받는 순간 화면마다 다른
 * 문장이 가능해지고, 이 문구는 상위기획서 §10 이 확정한 변경 금지 원문이다.
 * 접기(collapse) 처리도 하지 않는다(§4-4-3).
 *
 * 노출 4곳 중 수락 웹은 SCR-W02(검토)와 SCR-W03(승인 완료) 둘이다.
 */
export function LfDisclaimer(): React.JSX.Element {
  return <p className="lf-disclaimer">{LEGAL_DISCLAIMER}</p>;
}
