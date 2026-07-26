import { describe, expect, test } from 'vitest';

import { TRUST_MIN_SAMPLE } from './config.js';
import { calculateKeepRate } from './keep-rate.js';

// 근거: 02_세부기능명세서 §4-9-1 약속 지킴율.
//   분자 = COMPLETED,  분모 = COMPLETED + BROKEN,  round(분자/분모 × 100)
//   분모 < TRUST_MIN_SAMPLE 이면 % 대신 "집계 중" (S-2)
// DISPUTED·UNRESOLVED·DECLINED·CANCELED 는 비율에서 빠지므로 애초에 인자로 오지 않는다.
describe('calculateKeepRate', () => {
  test('모두 지켰으면 100 이다', () => {
    expect(calculateKeepRate({ completedCount: 3, brokenCount: 0 })).toBe(100);
  });

  test('모두 어겼으면 0 이다', () => {
    expect(calculateKeepRate({ completedCount: 0, brokenCount: 3 })).toBe(0);
  });

  test('소수점 없이 반올림한다', () => {
    // 2/3 = 66.66… → 67
    expect(calculateKeepRate({ completedCount: 2, brokenCount: 1 })).toBe(67);
    // 1/3 = 33.33… → 33
    expect(calculateKeepRate({ completedCount: 1, brokenCount: 2 })).toBe(33);
  });

  test('절반이면 50 이다', () => {
    expect(calculateKeepRate({ completedCount: 5, brokenCount: 5 })).toBe(50);
  });

  test('표본이 최소치에 못 미치면 null 이다 — 화면은 "집계 중"으로 표시한다', () => {
    expect(calculateKeepRate({ completedCount: 2, brokenCount: 0 })).toBeNull();
    expect(calculateKeepRate({ completedCount: 1, brokenCount: 1 })).toBeNull();
  });

  test('종결 이력이 하나도 없어도 null 이다 — 0% 로 보이면 안 된다', () => {
    expect(calculateKeepRate({ completedCount: 0, brokenCount: 0 })).toBeNull();
  });

  test('최소 표본에 정확히 도달하면 집계를 시작한다', () => {
    const atThreshold = calculateKeepRate({ completedCount: TRUST_MIN_SAMPLE, brokenCount: 0 });
    expect(atThreshold).toBe(100);

    const belowThreshold = calculateKeepRate({
      completedCount: TRUST_MIN_SAMPLE - 1,
      brokenCount: 0,
    });
    expect(belowThreshold).toBeNull();
  });
});
