import { createHash } from 'node:crypto';

/**
 * `content_hash` 의 **독립 참조 구현** — 02 §4-4-2.
 *
 * 이건 테스트 오라클이지 운영 코드가 아니다. 운영 해시는 Postgres 함수
 * `lf_content_hash` 가 만들고, 테스트가 둘을 대조한다. 하나의 구현이 자기 자신을
 * 테스트하면 규칙을 잘못 읽은 실수는 절대 드러나지 않는다.
 *
 * `packages/shared` 에 두지 않는다 — 04 §7-3 이 해시 코드를 클라이언트에 두지 말라고
 * 못박았고, shared 는 앱·웹 양쪽에 실려 나간다.
 */

export interface HashInput {
  title: string;
  body: string;
  category: string;
  /** `YYYY-MM-DD` */
  endDate: string;
  keeper: string;
  reward: string | null;
  penalty: string | null;
  versionNo: number;
}

/** §4-4-2.2 — 문자열 값은 trim 후 NFC. null 은 빈 문자열로. */
function normalizeValue(value: string | null): string {
  return (value ?? '').trim().normalize('NFC');
}

/** JSON 문자열 이스케이프. 명세가 JSON 객체를 요구하므로 따옴표·역슬래시·제어문자를 처리한다. */
function jsonString(value: string): string {
  return JSON.stringify(value);
}

/**
 * §4-4-2.1 — 키 순서가 **고정**이다. 알파벳순이 아니다.
 * 객체를 만들어 `JSON.stringify` 하면 삽입 순서에 의존하게 되므로 직접 조립한다.
 */
export function canonicalJson(input: HashInput): string {
  const parts = [
    `"title":${jsonString(normalizeValue(input.title))}`,
    `"body":${jsonString(normalizeValue(input.body))}`,
    `"category":${jsonString(normalizeValue(input.category))}`,
    `"end_date":${jsonString(normalizeValue(input.endDate))}`,
    `"keeper":${jsonString(normalizeValue(input.keeper))}`,
    `"reward":${jsonString(normalizeValue(input.reward))}`,
    `"penalty":${jsonString(normalizeValue(input.penalty))}`,
    `"version_no":${input.versionNo}`,
  ];
  // §4-4-2.1 "공백 없음"
  return `{${parts.join(',')}}`;
}

/** §4-4-2.4 — UTF-8 → SHA-256 → 소문자 hex 64자 */
export function contentHash(input: HashInput): string {
  return createHash('sha256').update(Buffer.from(canonicalJson(input), 'utf8')).digest('hex');
}

/**
 * 기록 지문 — 사람이 읽는 표현. 예: `A3F9-77C2-01`
 *
 * 02 에 산출 규칙이 없어 PO 가 정했다(2026-07-26): 해시 앞 4자 - 다음 4자 - 버전번호 2자리.
 * 앞 8자를 쓰는 것은 §4-11-4 의 버전 이력 표시("content_hash 앞 8자")와도 맞는다.
 */
export function fingerprint(hash: string, versionNo: number): string {
  const head = hash.slice(0, 4).toUpperCase();
  const tail = hash.slice(4, 8).toUpperCase();
  return `${head}-${tail}-${String(versionNo).padStart(2, '0')}`;
}
