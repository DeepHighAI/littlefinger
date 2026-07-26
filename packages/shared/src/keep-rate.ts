/**
 * 약속 지킴율 — 02_세부기능명세서 §4-9-1.
 *
 * 화면 표시명은 "약속 지킴율"이다. 이행률·성공률로 부르지 않는다(O-D3).
 *
 * 분모에 들어가는 약속은 **내가 지킬 사람(keeper)인 약속**뿐이다(S-1).
 * 어느 쪽이 어겼는지는 판정하지 않으므로, keeper 가 BOTH 이고 BROKEN 이면
 * 양측 모두의 분모에 똑같이 반영된다(원칙 P1).
 *
 * 그 필터링은 조회 계층의 몫이고, 이 함수는 걸러진 건수만 받는다.
 */

import { TRUST_MIN_SAMPLE } from './config.ts';

export interface KeepRateCounts {
  /** 종결 상태가 COMPLETED 인 약속 수 */
  completedCount: number;
  /** 종결 상태가 BROKEN 인 약속 수 */
  brokenCount: number;
}

/**
 * 0~100 정수, 또는 표본이 모자라면 `null`.
 * `null` 은 화면에서 "집계 중"으로 표시한다 — 0% 로 보이면 안 된다(S-2).
 */
export function calculateKeepRate({ completedCount, brokenCount }: KeepRateCounts): number | null {
  const denominator = completedCount + brokenCount;
  if (denominator < TRUST_MIN_SAMPLE) return null;

  return Math.round((completedCount / denominator) * 100);
}
