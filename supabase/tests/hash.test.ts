import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createTestDb, type TestDb } from './harness.ts';
import { canonicalJson, contentHash, fingerprint, type HashInput } from './reference/content-hash.ts';

/**
 * `content_hash` · 기록 지문 — 02 §4-4-2.
 *
 * **두 개의 독립 구현을 대조한다.** 운영 해시는 Postgres 의 `lf_content_hash` 가 만들고,
 * `reference/content-hash.ts` 는 명세를 따로 읽어 구현한 오라클이다.
 * 한쪽이 규칙을 잘못 읽었으면 여기서 갈라진다 — 자기 자신을 테스트하는 구조로는 못 잡는다.
 *
 * 해시는 확정된 약속의 신원이다. 여기가 틀리면 기록 검증 잡(J-09)이 멀쩡한 약속을
 * "기록 검증 실패"로 낙인찍는다.
 */

let db: TestDb;

const BASE: HashInput = {
  title: '매일 30분 걷기',
  body: '평일 저녁에 동네 한 바퀴 돌기로 했다.',
  category: 'HABIT',
  endDate: '2026-08-31',
  keeper: 'BOTH',
  reward: '커피 한 잔 사주기',
  penalty: '설거지 1주일',
  versionNo: 1,
};

/** Postgres 쪽 구현을 부른다. 인자 순서는 SQL 함수 시그니처와 같다. */
async function sqlHash(input: HashInput): Promise<string> {
  const { rows } = await db.asAdmin(
    `select public.lf_content_hash($1, $2, $3::public.promise_category, $4::date,
                                   $5::public.keeper, $6, $7, $8) as h`,
    [
      input.title,
      input.body,
      input.category,
      input.endDate,
      input.keeper,
      input.reward,
      input.penalty,
      input.versionNo,
    ],
  );
  return String((rows[0] as { h: string }).h);
}

async function sqlFingerprint(hash: string, versionNo: number): Promise<string> {
  const { rows } = await db.asAdmin(`select public.lf_fingerprint($1, $2) as f`, [hash, versionNo]);
  return String((rows[0] as { f: string }).f);
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('SQL 구현과 참조 구현이 일치한다', () => {
  test('기본 입력', async () => {
    expect(await sqlHash(BASE)).toBe(contentHash(BASE));
  });

  test('보상·벌칙이 없는 약속', async () => {
    const input = { ...BASE, reward: null, penalty: null };
    expect(await sqlHash(input)).toBe(contentHash(input));
  });

  test('본문에 개행이 있는 약속', async () => {
    const input = { ...BASE, body: '첫째 줄\n둘째 줄' };
    expect(await sqlHash(input)).toBe(contentHash(input));
  });

  test('따옴표와 역슬래시가 든 제목 — JSON 이스케이프가 양쪽에서 같아야 한다', async () => {
    const input = { ...BASE, title: '"큰따옴표" 와 \\역슬래시' };
    expect(await sqlHash(input)).toBe(contentHash(input));
  });

  test('이모지가 든 약속', async () => {
    const input = { ...BASE, body: '매일 걷기 👍🏽 화이팅' };
    expect(await sqlHash(input)).toBe(contentHash(input));
  });

  test('버전이 올라간 약속', async () => {
    const input = { ...BASE, versionNo: 12 };
    expect(await sqlHash(input)).toBe(contentHash(input));
  });
});

describe('정규화 — §4-4-2.2', () => {
  /**
   * 정규화되는 문자열 필드는 넷이다. 한 필드만 검사하면 나머지 셋에서 trim·NFC 가
   * 빠져도 통과한다 — 변이 테스트로 실제 확인한 구멍이라 필드마다 건다.
   */
  const NORMALIZED_FIELDS = ['title', 'body', 'reward', 'penalty'] as const;

  test.each(NORMALIZED_FIELDS)('%s 의 앞뒤 공백은 해시에 영향이 없다', async (field) => {
    const clean = { ...BASE, [field]: '내용' } as HashInput;
    const padded = { ...BASE, [field]: '  내용  ' } as HashInput;

    expect(await sqlHash(padded)).toBe(await sqlHash(clean));
    expect(contentHash(padded)).toBe(contentHash(clean));
  });

  test.each(NORMALIZED_FIELDS)('%s 의 한글 조합형과 완성형이 같은 해시를 낸다', async (field) => {
    // 조합형 "가속" — NFC 없이는 다른 바이트열이라 해시가 갈린다.
    const jamo = String.fromCodePoint(0x1100, 0x1161, 0x1109, 0x1169, 0x11a8);
    const composed = { ...BASE, [field]: '가속' } as HashInput;
    const decomposed = { ...BASE, [field]: jamo } as HashInput;

    expect(await sqlHash(decomposed)).toBe(await sqlHash(composed));
    expect(contentHash(decomposed)).toBe(contentHash(composed));
  });

  test.each(['reward', 'penalty'] as const)('%s 는 null 과 빈 문자열이 같다', async (field) => {
    const withNull = { ...BASE, [field]: null } as HashInput;
    const withEmpty = { ...BASE, [field]: '' } as HashInput;
    expect(await sqlHash(withNull)).toBe(await sqlHash(withEmpty));
  });
});

describe('해시가 실제로 내용을 구분한다', () => {
  test.each([
    ['title', { title: '다른 제목' }],
    ['body', { body: '다른 내용이다' }],
    ['category', { category: 'BET' }],
    ['end_date', { endDate: '2026-09-01' }],
    ['keeper', { keeper: 'CREATOR' }],
    ['reward', { reward: '다른 보상' }],
    ['penalty', { penalty: '다른 벌칙' }],
    ['version_no', { versionNo: 2 }],
  ] as const)('%s 가 바뀌면 해시가 바뀐다', async (_field, patch) => {
    const changed = { ...BASE, ...patch };
    expect(await sqlHash(changed)).not.toBe(await sqlHash(BASE));
  });

  test('내용이 같아도 버전이 다르면 해시가 다르다', async () => {
    // version_no 가 해시 대상 필드라서, 변경 승인으로 같은 내용이 재확정돼도 지문이 갱신된다.
    expect(await sqlHash({ ...BASE, versionNo: 2 })).not.toBe(await sqlHash(BASE));
  });
});

describe('출력 형식 — §4-4-2.4', () => {
  test('소문자 hex 64자다', async () => {
    const hash = await sqlHash(BASE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
  });

  test('char(64) 컬럼에 그대로 들어간다', async () => {
    const hash = await sqlHash(BASE);
    expect(hash.length).toBe(64);
  });
});

describe('정규 JSON — 키 순서가 고정이다', () => {
  test('명세가 정한 순서 그대로 직렬화한다', () => {
    // 알파벳순(body, category, end_date, …)이 아니라 명세 순서다.
    expect(canonicalJson(BASE)).toBe(
      '{"title":"매일 30분 걷기",' +
        '"body":"평일 저녁에 동네 한 바퀴 돌기로 했다.",' +
        '"category":"HABIT",' +
        '"end_date":"2026-08-31",' +
        '"keeper":"BOTH",' +
        '"reward":"커피 한 잔 사주기",' +
        '"penalty":"설거지 1주일",' +
        '"version_no":1}',
    );
  });

  test('공백이 없다', () => {
    expect(canonicalJson(BASE)).not.toMatch(/:\s|,\s/u);
  });
});

describe('기록 지문 — PO 결정 2026-07-26', () => {
  test('해시 앞 4자 - 다음 4자 - 버전 2자리', async () => {
    const hash = 'a3f977c2' + 'f'.repeat(56);
    expect(await sqlFingerprint(hash, 1)).toBe('A3F9-77C2-01');
  });

  test('SQL 과 참조 구현이 일치한다', async () => {
    const hash = await sqlHash(BASE);
    expect(await sqlFingerprint(hash, BASE.versionNo)).toBe(fingerprint(hash, BASE.versionNo));
  });

  test('대문자로 보여준다', async () => {
    const hash = await sqlHash(BASE);
    const shown = await sqlFingerprint(hash, 1);
    expect(shown).toBe(shown.toUpperCase());
  });

  test('버전이 두 자리를 넘어도 잘리지 않는다', async () => {
    const hash = 'a3f977c2' + '0'.repeat(56);
    expect(await sqlFingerprint(hash, 123)).toBe('A3F9-77C2-123');
  });

  test('§4-11-4 의 "content_hash 앞 8자"와 같은 구간을 쓴다', async () => {
    const hash = await sqlHash(BASE);
    const shown = await sqlFingerprint(hash, 1);
    expect(shown.replace(/-/gu, '').slice(0, 8)).toBe(hash.slice(0, 8).toUpperCase());
  });
});
