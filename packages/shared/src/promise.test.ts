import { describe, expect, test } from 'vitest';

import {
  KEEPER_LABEL,
  LEGAL_DISCLAIMER,
  PARTICIPANT_ROLE_LABEL,
  PROMISE_CATEGORY_LABEL,
  PROMISE_STATUS_LABEL,
  PROMISE_STATUSES,
  RATE_COUNTED_STATUSES,
  RATE_EXCLUDED_STATUSES,
  TERMINAL_STATUSES,
  type TrustProfile,
} from './promise.ts';

const trustProfile: TrustProfile = {
  userId: 'user-id',
  keepRate: null,
  completedCount: 0,
  brokenCount: 0,
  disputedCount: 0,
  unresolvedCount: 0,
  activeCount: 2,
};

// 근거: 02_세부기능명세서 §2-4 상태 값(변경 금지), §6-3 Enum 목록
describe('PROMISE_STATUSES', () => {
  test('명세의 11개 상태를 그대로 쓴다', () => {
    expect(PROMISE_STATUSES).toEqual([
      'DRAFT',
      'PENDING',
      'ACTIVE',
      'AMEND_PENDING',
      'CHECKING',
      'COMPLETED',
      'BROKEN',
      'DISPUTED',
      'UNRESOLVED',
      'DECLINED',
      'CANCELED',
    ]);
  });

  test('모든 상태에 화면 라벨이 있다', () => {
    for (const status of PROMISE_STATUSES) {
      expect(PROMISE_STATUS_LABEL[status], `${status} 라벨`).toBeTruthy();
    }
  });

  test('라벨은 용어 사전을 따른다', () => {
    expect(PROMISE_STATUS_LABEL.ACTIVE).toBe('진행 중');
    expect(PROMISE_STATUS_LABEL.BROKEN).toBe('불이행');
    expect(PROMISE_STATUS_LABEL.DISPUTED).toBe('의견 불일치');
    // S-15 확정: "무응답 종결"이 아니라 "미확정 종결"
    expect(PROMISE_STATUS_LABEL.UNRESOLVED).toBe('미확정 종결');
  });
});

// 근거: §4-9-1 — 지킴율에 반영되는 상태와 빠지는 상태
describe('지킴율 집계 상태 구분', () => {
  test('진행 중 건수는 비율과 별도인 공개 프로필 필드다', () => {
    expect(trustProfile.activeCount).toBe(2);
  });

  test('비율에 반영되는 상태는 COMPLETED 와 BROKEN 뿐이다', () => {
    expect([...RATE_COUNTED_STATUSES].sort()).toEqual(['BROKEN', 'COMPLETED']);
  });

  test('나머지 종결 상태는 비율에서 빠지고 건수로만 표기된다', () => {
    expect([...RATE_EXCLUDED_STATUSES].sort()).toEqual(
      ['CANCELED', 'DECLINED', 'DISPUTED', 'UNRESOLVED'].sort(),
    );
  });

  test('두 집합은 겹치지 않는다', () => {
    const overlap = RATE_COUNTED_STATUSES.filter((s) => RATE_EXCLUDED_STATUSES.includes(s));
    expect(overlap).toEqual([]);
  });

  test('두 집합을 합치면 종결 상태 전부가 된다 — 어느 쪽에도 없는 종결 상태가 있으면 안 된다', () => {
    const covered = [...RATE_COUNTED_STATUSES, ...RATE_EXCLUDED_STATUSES].sort();
    expect(covered).toEqual([...TERMINAL_STATUSES].sort());
  });

  test('진행 중인 상태는 어느 집합에도 들어가지 않는다', () => {
    for (const status of ['DRAFT', 'PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING'] as const) {
      expect(RATE_COUNTED_STATUSES).not.toContain(status);
      expect(RATE_EXCLUDED_STATUSES).not.toContain(status);
    }
  });
});

// 근거: §2-1 — "지킬 사람"의 코드 식별자는 keeper 다 (obligor 가 아니다)
describe('KEEPER_LABEL', () => {
  test('세 값 모두 라벨이 있다', () => {
    expect(KEEPER_LABEL).toEqual({
      CREATOR: '작성자',
      PARTNER: '상대방',
      BOTH: '둘 다',
    });
  });

  test('보는 사람에 따라 바뀌는 호칭을 쓰지 않는다', () => {
    // §5-1: 수락 웹의 상대방도 같은 문구를 읽어야 하므로 "나 / 상대"로 렌더하지 않는다.
    const labels = Object.values(KEEPER_LABEL);
    expect(labels).not.toContain('나');
    expect(labels).not.toContain('상대');
  });
});

describe('라벨 상수', () => {
  test('역할 라벨은 작성자·상대방·증인이다', () => {
    expect(PARTICIPANT_ROLE_LABEL).toEqual({
      CREATOR: '작성자',
      PARTNER: '상대방',
      WITNESS: '증인',
    });
  });

  test('카테고리 라벨은 습관·내기·금전·기타다', () => {
    expect(PROMISE_CATEGORY_LABEL).toEqual({
      HABIT: '습관',
      BET: '내기',
      MONEY: '금전',
      ETC: '기타',
    });
  });
});

// 04 §12-2 절대제약: 디스클레이머 문구는 상수 그대로, 변경 금지.
// 이 테스트가 그 제약의 코드 레벨 강제 장치다.
describe('LEGAL_DISCLAIMER', () => {
  test('상위기획서 §10 확정 문구와 한 글자도 다르지 않다', () => {
    expect(LEGAL_DISCLAIMER).toBe(
      '리틀핑거의 약속 기록은 공증이나 전자계약 서비스가 아니며, 법적 효력을 보증하지 않습니다. ' +
        '다만 양측의 승인 이력과 시각 정보는 분쟁 시 참고 자료로 활용될 수 있습니다.',
    );
  });

  test('계약서로 오인시킬 단어를 쓰지 않는다', () => {
    // 04 §12-3: 계약서·도장·법원 메타포 금지
    for (const forbidden of ['계약서', '도장', '법원', '소송']) {
      expect(LEGAL_DISCLAIMER).not.toContain(forbidden);
    }
  });
});
