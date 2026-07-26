import { describe, expect, test } from 'vitest';

import { END_DATE_MAX_DAYS, EVIDENCE_MAX_COUNT, EVIDENCE_MAX_MB } from './config.ts';
import {
  validateAmendSuggestion,
  validateBody,
  validateCategory,
  validateComment,
  validateDeclineReason,
  validateEmail,
  validateEndDate,
  validateEvidences,
  validateKeeper,
  validateReward,
  validateTitle,
} from './validation.ts';

// 근거: 02_세부기능명세서 §5 필드 명세, §2-3 입력·검증·에러 표준.
//
// 검증은 반드시 normalizeInput 뒤에 돈다. 그래서 "  약  " 처럼 공백으로 부풀린 입력이
// 길이 제한을 통과하지 못하고, 한글 조합형 자모도 NFC 로 합쳐진 뒤 세어진다.
// 실패 문구는 명세 원문 그대로 쓴다 — 지어내지 않는다.

const MAX_DATE_MSG = '종료일은 내일부터 1년 안으로 정해주세요.';

/** 편의: 유효하면 true */
const ok = (result: { valid: boolean }) => result.valid;

const JAMO_GASOK = String.fromCodePoint(0x1100, 0x1161, 0x1109, 0x1169, 0x11a8); // 조합형 "가속"

describe('validateTitle — 2~40자, 개행 불가', () => {
  test('2자면 통과한다', () => {
    expect(ok(validateTitle('약속'))).toBe(true);
  });

  test('40자면 통과한다', () => {
    expect(ok(validateTitle('가'.repeat(40)))).toBe(true);
  });

  test('1자는 거절하고 명세 문구를 돌려준다', () => {
    const result = validateTitle('약');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('제목을 2자 이상 입력해 주세요.');
  });

  test('41자는 거절한다', () => {
    expect(ok(validateTitle('가'.repeat(41)))).toBe(false);
  });

  test('길이 초과에는 "2자 이상" 문구를 쓰지 않는다', () => {
    // §5-1 의 실패 문구는 최소 길이 위반용이다. 41자를 넣은 사람에게
    // "2자 이상 입력해 주세요"는 틀린 안내다. 명세에 문구가 없으므로 null.
    expect(validateTitle('가'.repeat(41)).message).toBeNull();
  });

  test('개행 위반에도 "2자 이상" 문구를 쓰지 않는다', () => {
    expect(validateTitle('약속\n입니다').message).toBeNull();
  });

  test('빈 값은 거절한다 — 필수 필드다', () => {
    expect(ok(validateTitle(''))).toBe(false);
  });

  test('공백만 있는 입력은 정규화 뒤 빈 값이라 거절한다', () => {
    expect(ok(validateTitle('    '))).toBe(false);
  });

  test('공백으로 길이를 채워 통과시킬 수 없다', () => {
    // 정규화 전이면 3자, trim 뒤에는 1자.
    expect(ok(validateTitle(' 약 '))).toBe(false);
  });

  test('개행이 들어가면 거절한다', () => {
    expect(ok(validateTitle('약속\n입니다'))).toBe(false);
  });

  test('이모지는 1자로 센다', () => {
    // 39자 + 이모지 1자 = 40자
    expect(ok(validateTitle('가'.repeat(39) + '👍'))).toBe(true);
    expect(ok(validateTitle('가'.repeat(40) + '👍'))).toBe(false);
  });

  test('한글 조합형 자모는 NFC 로 합쳐진 뒤 세어진다', () => {
    // 정규화 전 5 코드포인트, 후 2자. 2자 하한을 통과해야 한다.
    expect(ok(validateTitle(JAMO_GASOK))).toBe(true);
  });
});

describe('validateBody — 5~1000자, 최대 20줄', () => {
  test('5자면 통과한다', () => {
    expect(ok(validateBody('매일 걷기'))).toBe(true);
  });

  test('4자는 거절하고 명세 문구를 돌려준다', () => {
    const result = validateBody('매일걷기');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('어떤 약속인지 5자 이상 적어주세요.');
  });

  test('1000자면 통과하고 1001자는 거절한다', () => {
    expect(ok(validateBody('가'.repeat(1000)))).toBe(true);
    expect(ok(validateBody('가'.repeat(1001)))).toBe(false);
  });

  test('길이 초과·줄 수 초과에는 "5자 이상" 문구를 쓰지 않는다', () => {
    expect(validateBody('가'.repeat(1001)).message).toBeNull();
    const tooManyLines = Array.from({ length: 21 }, (_, i) => `${i + 1}번째 줄`).join('\n');
    expect(validateBody(tooManyLines).message).toBeNull();
  });

  test('개행을 허용한다', () => {
    expect(ok(validateBody('매일\n걷기'))).toBe(true);
  });

  test('20줄까지 허용한다', () => {
    const twentyLines = Array.from({ length: 20 }, (_, i) => `${i + 1}번째 줄`).join('\n');
    expect(ok(validateBody(twentyLines))).toBe(true);
  });

  test('21줄은 거절한다', () => {
    const twentyOneLines = Array.from({ length: 21 }, (_, i) => `${i + 1}번째 줄`).join('\n');
    expect(ok(validateBody(twentyOneLines))).toBe(false);
  });

  test('개행 축약 뒤 줄 수를 센다', () => {
    // 3줄 이상 연속 개행은 2줄로 줄어드니, 축약 전 기준으로 21줄을 넘겨도 통과할 수 있다.
    const collapsed = '첫 줄' + '\n'.repeat(30) + '둘째 줄';
    expect(ok(validateBody(collapsed))).toBe(true);
  });
});

describe('validateCategory', () => {
  test('명세의 네 값만 통과한다', () => {
    for (const category of ['HABIT', 'BET', 'MONEY', 'ETC']) {
      expect(ok(validateCategory(category)), category).toBe(true);
    }
  });

  test('목록에 없는 값은 거절한다', () => {
    expect(ok(validateCategory('EXERCISE'))).toBe(false);
    expect(ok(validateCategory(''))).toBe(false);
    expect(ok(validateCategory('habit'))).toBe(false);
  });
});

describe('validateKeeper', () => {
  test('CREATOR / PARTNER / BOTH 만 통과한다', () => {
    for (const keeper of ['CREATOR', 'PARTNER', 'BOTH']) {
      expect(ok(validateKeeper(keeper)), keeper).toBe(true);
    }
  });

  test('역할 값인 WITNESS 는 지킬 사람이 될 수 없다', () => {
    expect(ok(validateKeeper('WITNESS'))).toBe(false);
  });
});

describe('validateEndDate — 내일부터 오늘+365일까지, KST 기준', () => {
  // 2026-07-25T15:00:00Z = KST 2026-07-26 00:00. 오늘(KST)은 2026-07-26.
  const now = new Date('2026-07-25T15:00:00Z');

  test('내일이면 통과한다', () => {
    expect(ok(validateEndDate('2026-07-27', now))).toBe(true);
  });

  test('오늘은 거절한다 — 종료일은 최소 내일이다', () => {
    const result = validateEndDate('2026-07-26', now);
    expect(result.valid).toBe(false);
    expect(result.message).toBe(MAX_DATE_MSG);
  });

  test('어제는 거절한다', () => {
    expect(ok(validateEndDate('2026-07-25', now))).toBe(false);
  });

  test('오늘+365일이면 통과한다', () => {
    // 2026-07-26 + 365일 = 2027-07-26. 2027 은 윤년이 아니라 사이에 2월 29일이 없다.
    expect(ok(validateEndDate('2027-07-26', now))).toBe(true);
  });

  test('오늘+366일은 거절한다', () => {
    expect(ok(validateEndDate('2027-07-27', now))).toBe(false);
  });

  test('윤년을 지나면 상한 날짜가 하루 당겨진다', () => {
    // 2027-07-26 기준 +365일은 2028-02-29 를 포함하므로 2028-07-25 다.
    const beforeLeapYear = new Date('2027-07-25T15:00:00Z'); // KST 2027-07-26
    expect(ok(validateEndDate('2028-07-25', beforeLeapYear))).toBe(true);
    expect(ok(validateEndDate('2028-07-26', beforeLeapYear))).toBe(false);
  });

  test('상한은 END_DATE_MAX_DAYS 에서 온다', () => {
    // 숫자 365 를 검증 로직에 박지 않았는지 확인한다.
    expect(END_DATE_MAX_DAYS).toBe(365);
  });

  test('KST 로 날이 바뀌면 하한도 함께 움직인다', () => {
    // UTC 14:59:59 는 아직 KST 07-25 이므로 07-26 이 "내일"이다.
    const beforeMidnightKst = new Date('2026-07-25T14:59:59Z');
    expect(ok(validateEndDate('2026-07-26', beforeMidnightKst))).toBe(true);
    // 1초 뒤 KST 로 07-26 이 되면 같은 날짜가 "오늘"이 되어 거절된다.
    expect(ok(validateEndDate('2026-07-26', now))).toBe(false);
  });

  test('날짜 형식이 아니면 거절한다', () => {
    expect(ok(validateEndDate('2026/07/27', now))).toBe(false);
    expect(ok(validateEndDate('', now))).toBe(false);
    expect(ok(validateEndDate('2026-13-01', now))).toBe(false);
  });
});

describe('validateReward / validatePenalty — 0~100자, 선택', () => {
  test('빈 값을 허용한다 — 선택 항목이다', () => {
    expect(ok(validateReward(''))).toBe(true);
  });

  test('100자면 통과하고 101자는 거절한다', () => {
    expect(ok(validateReward('가'.repeat(100)))).toBe(true);
    expect(ok(validateReward('가'.repeat(101)))).toBe(false);
  });

  test('프리셋 문구가 통과한다', () => {
    expect(ok(validateReward('커피 한 잔 사주기'))).toBe(true);
  });
});

describe('validateAmendSuggestion — 5~300자, 수정 제안 시 필수', () => {
  test('5자면 통과한다', () => {
    expect(ok(validateAmendSuggestion('기간 조정'))).toBe(true);
  });

  test('4자는 거절하고 명세 문구를 돌려준다', () => {
    const result = validateAmendSuggestion('기간수정');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('어떤 부분을 바꾸고 싶은지 알려주세요.');
  });

  test('300자면 통과하고 301자는 거절한다', () => {
    expect(ok(validateAmendSuggestion('가'.repeat(300)))).toBe(true);
    expect(ok(validateAmendSuggestion('가'.repeat(301)))).toBe(false);
  });
});

describe('validateDeclineReason / validateComment — 0~200자, 선택', () => {
  test('빈 값을 허용한다', () => {
    expect(ok(validateDeclineReason(''))).toBe(true);
    expect(ok(validateComment(''))).toBe(true);
  });

  test('200자면 통과하고 201자는 거절한다', () => {
    expect(ok(validateComment('가'.repeat(200)))).toBe(true);
    expect(ok(validateComment('가'.repeat(201)))).toBe(false);
  });
});

describe('validateEmail — RFC 5322, 선택', () => {
  test('빈 값을 허용한다 — 이메일은 선택이다', () => {
    expect(ok(validateEmail(''))).toBe(true);
  });

  test('평범한 주소를 통과시킨다', () => {
    expect(ok(validateEmail('batisututu@gmail.com'))).toBe(true);
    expect(ok(validateEmail('a.b+tag@sub.example.co.kr'))).toBe(true);
  });

  test('형식이 틀리면 명세 문구를 돌려준다', () => {
    const result = validateEmail('not-an-email');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('이메일 형식을 확인해 주세요.');
  });

  test('흔한 오입력을 잡는다', () => {
    for (const bad of ['a@', '@b.com', 'a b@c.com', 'a@b', 'a@@b.com']) {
      expect(ok(validateEmail(bad)), bad).toBe(false);
    }
  });
});

describe('validateEvidences — 최대 3장, 장당 10MB, 지정 형식만', () => {
  const mb = (n: number) => n * 1024 * 1024;
  const jpeg = { mime: 'image/jpeg', bytes: mb(1) };

  test('첨부가 없어도 통과한다 — 선택이다', () => {
    expect(ok(validateEvidences([]))).toBe(true);
  });

  test('상한 장수까지 통과한다', () => {
    expect(ok(validateEvidences(Array<typeof jpeg>(EVIDENCE_MAX_COUNT).fill(jpeg)))).toBe(true);
  });

  test('상한을 넘으면 거절한다', () => {
    expect(ok(validateEvidences(Array<typeof jpeg>(EVIDENCE_MAX_COUNT + 1).fill(jpeg)))).toBe(
      false,
    );
  });

  test('허용 형식 네 가지를 통과시킨다', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
      expect(ok(validateEvidences([{ mime, bytes: mb(1) }])), mime).toBe(true);
    }
  });

  test('허용되지 않은 형식은 거절한다', () => {
    for (const mime of ['image/gif', 'application/pdf', 'video/mp4', '']) {
      expect(ok(validateEvidences([{ mime, bytes: mb(1) }])), mime).toBe(false);
    }
  });

  test('장당 용량 상한을 넘으면 거절한다', () => {
    expect(ok(validateEvidences([{ mime: 'image/jpeg', bytes: mb(EVIDENCE_MAX_MB) }]))).toBe(true);
    expect(ok(validateEvidences([{ mime: 'image/jpeg', bytes: mb(EVIDENCE_MAX_MB) + 1 }]))).toBe(
      false,
    );
  });

  test('상한 판정에 상수를 쓴다', () => {
    expect(EVIDENCE_MAX_COUNT).toBe(3);
    expect(EVIDENCE_MAX_MB).toBe(10);
  });
});
