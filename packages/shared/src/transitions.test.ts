import { describe, expect, test } from 'vitest';

import { PROMISE_STATUSES } from './promise.ts';
import { canTransition, TRANSITIONS } from './transitions.ts';

// 근거: 02_세부기능명세서 §7-1 전이표.
// "이 표에 없는 전이는 구현하지 않는다" — 그래서 허용 목록이 아니라 전수 검사로 잠근다.

/** §7-1 표에서 상태가 실제로 바뀌는 전이만 추린 것 (T-01 은 생성이라 from 이 없다) */
const ALLOWED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['DRAFT', 'PENDING'], // T-02 초대 발송
  ['PENDING', 'ACTIVE'], // T-03 상대 승인
  ['PENDING', 'DECLINED'], // T-04 상대 거절 · T-18 상대 탈퇴
  ['PENDING', 'DRAFT'], // T-05 상대 수정 제안
  ['PENDING', 'PENDING'], // T-06 초대 만료 — 상태는 유지되고 재발송 가능
  ['ACTIVE', 'AMEND_PENDING'], // T-07 변경·파기 요청
  ['AMEND_PENDING', 'ACTIVE'], // T-08 변경 승인 · T-09 거절/철회/만료
  ['AMEND_PENDING', 'CANCELED'], // T-10 파기 승인
  ['ACTIVE', 'CHECKING'], // T-11 종료일 익일 00:00 KST
  ['CHECKING', 'COMPLETED'], // T-12 양측 KEPT
  ['CHECKING', 'BROKEN'], // T-13 양측 NOT_KEPT
  ['CHECKING', 'DISPUTED'], // T-14 응답 불일치
  ['CHECKING', 'UNRESOLVED'], // T-15 기한 경과
  ['DISPUTED', 'CHECKING'], // T-16 재협의
  ['DISPUTED', 'DISPUTED'], // T-17 재협의 라운드도 불일치
];

describe('TRANSITIONS', () => {
  test('T-01 부터 T-18 까지 빠짐없이 정의한다', () => {
    const ids = TRANSITIONS.map((t) => t.id);
    const expected = Array.from({ length: 18 }, (_, i) => `T-${String(i + 1).padStart(2, '0')}`);
    expect(ids).toEqual(expected);
  });

  test('T-01 은 신규 생성이라 이전 상태가 없다', () => {
    const created = TRANSITIONS.find((t) => t.id === 'T-01');
    expect(created?.from).toBeNull();
    expect(created?.to).toBe('DRAFT');
  });

  test('모든 전이의 상태 값이 §2-4 의 11개 안에 있다', () => {
    for (const transition of TRANSITIONS) {
      if (transition.from !== null) {
        expect(PROMISE_STATUSES, `${transition.id} from`).toContain(transition.from);
      }
      expect(PROMISE_STATUSES, `${transition.id} to`).toContain(transition.to);
    }
  });
});

describe('canTransition — 표에 있는 전이', () => {
  test.each(ALLOWED_PAIRS)('%s → %s 는 허용된다', (from, to) => {
    expect(canTransition(from as never, to as never)).toBe(true);
  });
});

describe('canTransition — 표에 없는 전이는 전부 막는다', () => {
  test('11 × 11 조합 중 표에 있는 것만 통과한다', () => {
    const allowed = new Set(ALLOWED_PAIRS.map(([from, to]) => `${from}>${to}`));
    const wronglyAllowed: string[] = [];

    for (const from of PROMISE_STATUSES) {
      for (const to of PROMISE_STATUSES) {
        const isAllowed = canTransition(from, to);
        if (isAllowed !== allowed.has(`${from}>${to}`)) {
          wronglyAllowed.push(`${from} → ${to} 가 ${isAllowed ? '열려' : '막혀'} 있다`);
        }
      }
    }

    expect(wronglyAllowed).toEqual([]);
  });

  test('§7-1 이 명시적으로 없다고 못박은 전이들', () => {
    // 이행 확인 중에는 변경 협의로 갈 수 없다
    expect(canTransition('CHECKING', 'AMEND_PENDING')).toBe(false);
    // 이행 확인을 건너뛰고 완료될 수 없다
    expect(canTransition('ACTIVE', 'COMPLETED')).toBe(false);
  });

  test('완전 종결 상태에서는 어디로도 갈 수 없다', () => {
    for (const terminal of ['COMPLETED', 'UNRESOLVED', 'CANCELED', 'DECLINED'] as const) {
      for (const to of PROMISE_STATUSES) {
        expect(canTransition(terminal, to), `${terminal} → ${to}`).toBe(false);
      }
    }
  });

  test('DISPUTED 는 준종결이라 CHECKING 으로만 되돌아갈 수 있다', () => {
    // S-13 · T-16. 다른 종결 상태와 달리 재협의 경로가 열려 있다.
    expect(canTransition('DISPUTED', 'CHECKING')).toBe(true);
    expect(canTransition('DISPUTED', 'COMPLETED')).toBe(false);
    expect(canTransition('DISPUTED', 'BROKEN')).toBe(false);
  });

  test('확정 후에는 DRAFT 로 되돌아갈 수 없다', () => {
    // 원칙 P3 확정 후 불변. 되돌리기는 새 버전 추가로만 표현한다.
    expect(canTransition('ACTIVE', 'DRAFT')).toBe(false);
    expect(canTransition('CHECKING', 'DRAFT')).toBe(false);
  });
});
