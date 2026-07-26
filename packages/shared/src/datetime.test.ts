import { describe, expect, test } from 'vitest';

import {
  checkDeadlineAt,
  checkingStartsAt,
  ddayFrom,
  formatDday,
  isImminent,
  isQuietHours,
  toKstDate,
} from './datetime.js';

// 근거: 02_세부기능명세서 §2-2 시각·날짜 규칙, §6-4 파생 값 계산 규칙
// 핵심 전제: 저장은 UTC, 계산·표시는 Asia/Seoul 고정. 기기 타임존을 따르지 않는다(EC-F09).

describe('toKstDate', () => {
  test('UTC 15:00 은 KST 로 다음 날 00:00 이다', () => {
    expect(toKstDate(new Date('2026-07-25T15:00:00Z'))).toBe('2026-07-26');
  });

  test('UTC 14:59:59 는 아직 같은 날이다', () => {
    expect(toKstDate(new Date('2026-07-25T14:59:59Z'))).toBe('2026-07-25');
  });

  test('월말 경계를 넘긴다', () => {
    expect(toKstDate(new Date('2026-07-31T15:00:00Z'))).toBe('2026-08-01');
  });

  test('연말 경계를 넘긴다', () => {
    expect(toKstDate(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });

  test('한 자리 월·일을 0으로 채운다', () => {
    expect(toKstDate(new Date('2026-01-02T03:00:00Z'))).toBe('2026-01-02');
  });
});

describe('ddayFrom', () => {
  test('종료일이 오늘이면 0이다', () => {
    expect(ddayFrom('2026-07-26', new Date('2026-07-25T15:00:00Z'))).toBe(0);
  });

  test('종료일이 이레 뒤면 7이다', () => {
    expect(ddayFrom('2026-08-02', new Date('2026-07-26T00:00:00Z'))).toBe(7);
  });

  test('종료일이 지났으면 음수다', () => {
    expect(ddayFrom('2026-07-23', new Date('2026-07-26T00:00:00Z'))).toBe(-3);
  });

  test('KST 로 날이 바뀌는 순간 D 가 하루 줄어든다', () => {
    // UTC 14:59:59 → KST 07-25, D=1 / UTC 15:00:00 → KST 07-26, D=0
    expect(ddayFrom('2026-07-26', new Date('2026-07-25T14:59:59Z'))).toBe(1);
    expect(ddayFrom('2026-07-26', new Date('2026-07-25T15:00:00Z'))).toBe(0);
  });
});

describe('formatDday', () => {
  test('당일은 D-Day 다', () => {
    expect(formatDday(0)).toBe('D-Day');
  });

  test('남은 날은 D-n 이다', () => {
    expect(formatDday(7)).toBe('D-7');
    expect(formatDday(1)).toBe('D-1');
  });

  test('지난 날은 D+n 이다', () => {
    expect(formatDday(-3)).toBe('D+3');
  });
});

describe('isImminent', () => {
  test('ACTIVE 이고 D 가 0~3 이면 임박이다', () => {
    expect(isImminent('ACTIVE', 0)).toBe(true);
    expect(isImminent('ACTIVE', 3)).toBe(true);
  });

  test('D 가 3 을 넘으면 임박이 아니다', () => {
    expect(isImminent('ACTIVE', 4)).toBe(false);
  });

  test('종료일이 지났으면 임박이 아니다', () => {
    expect(isImminent('ACTIVE', -1)).toBe(false);
  });

  test('ACTIVE 가 아니면 임박이 아니다', () => {
    expect(isImminent('CHECKING', 1)).toBe(false);
    expect(isImminent('PENDING', 1)).toBe(false);
    expect(isImminent('COMPLETED', 1)).toBe(false);
  });
});

describe('checkingStartsAt', () => {
  test('종료일 익일 00:00 KST 다', () => {
    // 2026-07-26 00:00 KST = 2026-07-25 15:00 UTC
    expect(checkingStartsAt('2026-07-25').toISOString()).toBe('2026-07-25T15:00:00.000Z');
  });

  test('월말 종료일도 익월 1일로 넘긴다', () => {
    expect(checkingStartsAt('2026-07-31').toISOString()).toBe('2026-07-31T15:00:00.000Z');
  });
});

describe('checkDeadlineAt', () => {
  test('CHECKING 시작 + 7일이다', () => {
    const started = new Date('2026-07-25T15:00:00.000Z');
    expect(checkDeadlineAt(started).toISOString()).toBe('2026-08-01T15:00:00.000Z');
  });

  test('결과적으로 종료일 + 8일 00:00 KST 가 된다', () => {
    // 02 §2-2: "종료일 + 8일 00:00 KST 미응답 종결"
    const deadline = checkDeadlineAt(checkingStartsAt('2026-07-25'));
    expect(toKstDate(deadline)).toBe('2026-08-02');
  });
});

describe('isQuietHours', () => {
  test('KST 21:00 은 조용한 시간이다', () => {
    expect(isQuietHours(new Date('2026-07-25T12:00:00Z'))).toBe(true); // KST 21:00
  });

  test('KST 07:59 는 아직 조용한 시간이다', () => {
    expect(isQuietHours(new Date('2026-07-25T22:59:00Z'))).toBe(true); // KST 익일 07:59
  });

  test('KST 08:00 부터는 발송한다', () => {
    expect(isQuietHours(new Date('2026-07-25T23:00:00Z'))).toBe(false); // KST 익일 08:00
  });

  test('KST 20:59 까지는 발송한다', () => {
    expect(isQuietHours(new Date('2026-07-25T11:59:00Z'))).toBe(false); // KST 20:59
  });

  test('자정 넘어서도 조용한 시간이다', () => {
    expect(isQuietHours(new Date('2026-07-25T16:00:00Z'))).toBe(true); // KST 익일 01:00
  });
});
