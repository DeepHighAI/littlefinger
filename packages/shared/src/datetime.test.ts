import { describe, expect, test } from 'vitest';

import {
  checkDeadlineAt,
  checkingStartsAt,
  ddayFrom,
  formatDday,
  formatKstDate,
  formatKstDateTime,
  isIsoInstant,
  isImminent,
  isQuietHours,
  toKstDate,
} from './datetime.ts';

// 근거: 02_세부기능명세서 §2-2 시각·날짜 규칙, §6-4 파생 값 계산 규칙
// 핵심 전제: 저장은 UTC, 계산·표시는 Asia/Seoul 고정. 기기 타임존을 따르지 않는다(EC-F09).

describe('isIsoInstant', () => {
  test.each([
    '2026-08-15T00:00:00Z',
    '2026-08-15T00:00:00.123Z',
    '2026-08-15T09:00:00+09:00',
    '2026-08-14T22:00:00+00:00',
  ])('실재하는 RFC3339 instant를 허용한다: %s', (value) => {
    expect(isIsoInstant(value)).toBe(true);
  });

  test.each([
    '2026-02-30T00:00:00Z',
    '2026-13-01T00:00:00Z',
    '2026-08-15T24:00:00Z',
    '2026-08-15T00:60:00Z',
    '2026-08-15 00:00:00Z',
    '2026-08-15T00:00Z',
    '2026-08-15T00:00:00',
    '2026-08-15T00:00:00+0900',
  ])('불가능하거나 비정규 instant를 거절한다: %s', (value) => {
    expect(isIsoInstant(value)).toBe(false);
  });
});

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

describe('formatKstDate', () => {
  test('종료일에 요일을 붙인다', () => {
    // 2026-08-11 은 화요일. 레퍼런스 HTML 의 "2026-08-11 (화)" 와 같은 형식이다.
    expect(formatKstDate('2026-08-11')).toBe('2026-08-11 (화)');
  });

  test('일요일도 맞는다', () => {
    expect(formatKstDate('2026-08-09')).toBe('2026-08-09 (일)');
  });

  test('YYYY-MM-DD 는 이미 KST 날짜라 기기 타임존을 타지 않는다', () => {
    // **타임존을 실제로 옮겨 놓고 본다.** 개발 기계가 Asia/Seoul 이면 UTC 자정 값에서
    // `getDay()` 와 `getUTCDay()` 가 같은 답을 내서, 로컬 파싱으로 바꿔도 이 단언이
    // 통과한다 — 그러면 EC-F09 를 지키는 것이 아니라 기계 설정에 기대는 것이 된다.
    // UTC 서쪽에서만 하루가 밀린다.
    const original = process.env['TZ'];
    process.env['TZ'] = 'America/Los_Angeles';
    try {
      expect(formatKstDate('2026-01-01')).toBe('2026-01-01 (목)');
      expect(formatKstDate('2026-08-11')).toBe('2026-08-11 (화)');
    } finally {
      if (original === undefined) delete process.env['TZ'];
      else process.env['TZ'] = original;
    }
  });
});

describe('formatKstDateTime', () => {
  test('UTC 를 KST 로 밀어 분까지 적는다', () => {
    expect(formatKstDateTime(new Date('2026-07-12T12:04:33.500Z'))).toBe('2026-07-12 21:04');
  });

  test('KST 로 날짜가 넘어가는 구간', () => {
    // 15:00Z = 익일 00:00 KST. UTC 날짜를 그대로 쓰면 하루가 밀린다.
    expect(formatKstDateTime(new Date('2026-07-12T15:00:00Z'))).toBe('2026-07-13 00:00');
  });

  test('한 자리 수는 0 으로 채운다', () => {
    expect(formatKstDateTime(new Date('2026-01-05T00:09:00Z'))).toBe('2026-01-05 09:09');
  });

  test('(KST) 는 붙이지 않는다 — 자리는 화면이 정한다', () => {
    expect(formatKstDateTime(new Date('2026-07-12T12:04:00Z'))).not.toContain('KST');
  });
});
