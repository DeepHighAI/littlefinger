/**
 * 필드 검증 — 02_세부기능명세서 §5.
 *
 * 두 가지가 이 파일의 전제다.
 *
 * 1. **검증은 정규화 뒤에 돈다.** `normalizeInput` 을 거치지 않으면 공백으로 길이를 채운
 *    입력이 하한을 통과하고, 한글 조합형 자모가 실제보다 길게 세어진다.
 * 2. **실패 문구는 명세 원문이다.** §5 표에 없는 문구는 지어내지 않고 `null` 로 둔다 —
 *    화면에서 CTA 를 비활성화하는 것으로 충분한 필드가 있다(§2-3).
 *
 * 서버가 최종 판정이다(§2-3). 같은 규칙을 Edge Function 도 호출할 수 있도록
 * 순수 함수로만 만든다 — 여기 있는 어떤 함수도 현재 시각이나 기기 정보를 직접 읽지 않는다.
 */

import { END_DATE_MAX_DAYS, EVIDENCE_MAX_COUNT, EVIDENCE_MAX_MB } from './config.js';
import { toKstDate } from './datetime.js';
import type { Keeper, PromiseCategory } from './promise.js';
import { codepointLength, normalizeInput } from './text.js';

export interface ValidationResult {
  valid: boolean;
  /** 사용자에게 보일 문구. 명세에 문구가 없는 필드는 `null` 이다. */
  message: string | null;
}

const VALID: ValidationResult = { valid: true, message: null };

function invalid(message: string | null): ValidationResult {
  return { valid: false, message };
}

/** 정규화한 뒤 코드포인트로 센다. 이 순서를 바꾸면 길이 판정이 틀어진다. */
function normalizedLength(value: string): { text: string; length: number } {
  const text = normalizeInput(value);
  return { text, length: codepointLength(text) };
}

function checkLength(
  value: string,
  min: number,
  max: number,
  message: string | null,
): ValidationResult {
  const { length } = normalizedLength(value);
  return length >= min && length <= max ? VALID : invalid(message);
}

// ── §5-1 약속 작성 필드 ────────────────────────────────────

const TITLE_MIN = 2;
const TITLE_MAX = 40;
/** §5-1 의 이 문구는 **최소 길이 위반 전용**이다. 상한·개행 위반에 재사용하면 틀린 안내가 된다. */
const TITLE_TOO_SHORT = '제목을 2자 이상 입력해 주세요.';

/** 제목 — 2~40자, 개행 불가 */
export function validateTitle(value: string): ValidationResult {
  const { text, length } = normalizedLength(value);
  if (length < TITLE_MIN) return invalid(TITLE_TOO_SHORT);
  // 상한 초과와 개행은 §5-1 에 문구가 없다. 지어내지 않고 CTA 비활성으로 처리한다(§2-3).
  if (length > TITLE_MAX || text.includes('\n')) return invalid(null);
  return VALID;
}

const BODY_MIN = 5;
const BODY_MAX = 1000;
const BODY_MAX_LINES = 20;
/** 최소 길이 위반 전용 문구. 상한·줄 수 위반에는 쓰지 않는다. */
const BODY_TOO_SHORT = '어떤 약속인지 5자 이상 적어주세요.';

/** 약속 내용 — 5~1000자, 개행 허용하되 최대 20줄 */
export function validateBody(value: string): ValidationResult {
  const { text, length } = normalizedLength(value);
  if (length < BODY_MIN) return invalid(BODY_TOO_SHORT);
  // 줄 수는 개행 축약이 끝난 뒤 센다. 축약 전 기준으로 세면 빈 줄만으로 상한에 걸린다.
  if (length > BODY_MAX || text.split('\n').length > BODY_MAX_LINES) return invalid(null);
  return VALID;
}

const CATEGORIES: readonly string[] = ['HABIT', 'BET', 'MONEY', 'ETC'] satisfies PromiseCategory[];

/** 카테고리 — 미선택 시 CTA 를 비활성화하므로 별도 문구가 없다(§5-1). */
export function validateCategory(value: string): ValidationResult {
  return CATEGORIES.includes(value) ? VALID : invalid(null);
}

const KEEPERS: readonly string[] = ['CREATOR', 'PARTNER', 'BOTH'] satisfies Keeper[];

/** 지킬 사람 — 역할(WITNESS 포함)과는 다른 집합이다(§2-1). */
export function validateKeeper(value: string): ValidationResult {
  return KEEPERS.includes(value) ? VALID : invalid(null);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DAY_MS = 24 * 60 * 60 * 1000;
const END_DATE_MESSAGE = '종료일은 내일부터 1년 안으로 정해주세요.';

/** `YYYY-MM-DD` 가 실제로 존재하는 날짜인지 — 2026-13-01 같은 값을 거른다. */
function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === (month ?? 1) - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * 종료일 — **내일**부터 오늘 + `END_DATE_MAX_DAYS` 까지 (S-7). 기준은 KST.
 *
 * `now` 를 인자로 받는 이유: 기기 시계를 신뢰하지 않고, 승인 시점에 서버가
 * 같은 함수로 재검증할 수 있어야 하기 때문이다(T-03·T-08).
 */
export function validateEndDate(value: string, now: Date): ValidationResult {
  if (!isRealIsoDate(value)) return invalid(END_DATE_MESSAGE);

  const todayKst = Date.parse(`${toKstDate(now)}T00:00:00Z`);
  const endDate = Date.parse(`${value}T00:00:00Z`);
  const daysFromToday = Math.round((endDate - todayKst) / DAY_MS);

  return daysFromToday >= 1 && daysFromToday <= END_DATE_MAX_DAYS
    ? VALID
    : invalid(END_DATE_MESSAGE);
}

const STAKE_MAX = 100;

/** 보상 — 선택, 0~100자. 명세에 실패 문구가 없다. */
export function validateReward(value: string): ValidationResult {
  return checkLength(value, 0, STAKE_MAX, null);
}

/** 벌칙 — 선택, 0~100자. 화면 라벨은 항상 "벌칙"이다(패널티 아님). */
export function validatePenalty(value: string): ValidationResult {
  return checkLength(value, 0, STAKE_MAX, null);
}

// ── §5-3 초대·응답 필드 ────────────────────────────────────

/** 수정 제안 의견 — 수정 제안 시 필수, 5~300자 (T-05) */
export function validateAmendSuggestion(value: string): ValidationResult {
  const { length } = normalizedLength(value);
  if (length < 5) return invalid('어떤 부분을 바꾸고 싶은지 알려주세요.');
  return length <= 300 ? VALID : invalid(null);
}

/** 거절 사유 — 선택 (S-4 기본안), 0~200자 */
export function validateDeclineReason(value: string): ValidationResult {
  return checkLength(value, 0, 200, null);
}

// ── §5-2 이행 확인 필드 ────────────────────────────────────

/** 한 줄 의견 — 선택, 0~200자 */
export function validateComment(value: string): ValidationResult {
  return checkLength(value, 0, 200, null);
}

/**
 * 리마인드 이메일 — 선택, RFC 5322.
 *
 * RFC 5322 전문을 정규식으로 옮기지 않는다. 그 문법은 주석·따옴표 문자열까지 허용해서
 * 실무에서 쓰는 정규식은 어차피 근사치이고, 최종 확인은 발송 성공 여부다.
 * 여기서는 화면에서 오타를 잡아주는 수준으로만 본다.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/u;

export function validateEmail(value: string): ValidationResult {
  const { text } = normalizedLength(value);
  if (text === '') return VALID;
  return EMAIL.test(text) ? VALID : invalid('이메일 형식을 확인해 주세요.');
}

// ── §5-2 증빙 사진 ─────────────────────────────────────────

export interface EvidenceFile {
  mime: string;
  bytes: number;
}

const EVIDENCE_ALLOWED_MIME: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];

const EVIDENCE_MAX_BYTES = EVIDENCE_MAX_MB * 1024 * 1024;

/**
 * 증빙 사진 — 선택, 최대 `EVIDENCE_MAX_COUNT` 장, 장당 `EVIDENCE_MAX_MB` MB.
 * 업로드 실패는 `E_UPLOAD_FAILED` 로 응답한다(§2-3).
 *
 * EXIF 위치정보 제거와 비공개 버킷 저장은 서버의 몫이라 여기서 다루지 않는다(04 §12-8).
 */
export function validateEvidences(files: readonly EvidenceFile[]): ValidationResult {
  if (files.length > EVIDENCE_MAX_COUNT) return invalid(null);

  for (const file of files) {
    if (!EVIDENCE_ALLOWED_MIME.includes(file.mime)) return invalid(null);
    if (file.bytes > EVIDENCE_MAX_BYTES) return invalid(null);
  }

  return VALID;
}
