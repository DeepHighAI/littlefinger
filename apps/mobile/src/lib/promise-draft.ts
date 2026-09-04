import {
  validateBody,
  validateCategory,
  validateEndDate,
  validateKeeper,
  validatePenalty,
  validateReward,
  validateTitle,
  type Keeper,
  type Locale,
  type Localized,
  type PromiseCategory,
  type ValidationResult,
} from '@littlefinger/shared';

export interface PromiseDraftFields {
  title: string;
  body: string;
  category: PromiseCategory | '';
  end_date: string | null;
  keeper: Keeper;
  reward: string;
  penalty: string;
  witness_enabled: boolean;
}

export type PromiseDraftField = keyof PromiseDraftFields;

export interface PromiseDraftValidation {
  valid: boolean;
  fields: Partial<Record<PromiseDraftField, string>>;
  /**
   * 문구 유무와 무관한 실패 필드 전체(§5-1 순서). §5 에 문구가 없는 규칙은 `fields` 에
   * 안 실리므로, 어디로 안내할지는 이 목록만이 안다(PO 2026-08-26 미입력 안내).
   */
  invalidFields: readonly PromiseDraftField[];
}

export const EMPTY_PROMISE_DRAFT: PromiseDraftFields = {
  title: '',
  body: '',
  category: '',
  end_date: '',
  keeper: 'BOTH',
  reward: '',
  penalty: '',
  witness_enabled: false,
};

/**
 * 프리셋은 칩 라벨이자 선택 즉시 저장되는 본문이다 — 로케일은 고르는 순간의 문구만
 * 정하고, 저장된 텍스트는 이후 로케일 전환과 무관하게 그대로 남는다.
 */
const REWARD_PRESETS_BY_LOCALE: Localized<readonly string[]> = {
  ko: [
    '커피 한 잔 사주기',
    '다음 메뉴 선택권',
    '소원권 1장',
    '주말 계획 결정권',
    '칭찬 세 가지',
    '스벅쏘기',
    '올영쏘기',
    '만원',
  ],
  en: [
    'A coffee treat',
    'Pick the next menu',
    'One wish coupon',
    'Decide the weekend plan',
    'Three compliments',
    'Starbucks treat',
    'Olive Young treat',
    '10$',
  ],
};

const PENALTY_PRESETS_BY_LOCALE: Localized<readonly string[]> = {
  ko: [
    '커피 한 잔 사기',
    '설거지 1주일',
    '다음 데이트 비용',
    '노래방 한 곡',
    '소원권 1장 주기',
    '스벅쏘기',
    '올영쏘기',
    '만원',
    '나의 노예가 되어라',
  ],
  en: [
    'Buy a coffee',
    'Dishes for a week',
    'Pay for the next date',
    'Sing one karaoke song',
    'Give one wish coupon',
    'Starbucks treat',
    'Olive Young treat',
    '10$',
    'Be my servant',
  ],
};

export function rewardPresets(locale: Locale = 'ko'): readonly string[] {
  return REWARD_PRESETS_BY_LOCALE[locale];
}

export function penaltyPresets(locale: Locale = 'ko'): readonly string[] {
  return PENALTY_PRESETS_BY_LOCALE[locale];
}

function addResult(
  fields: Partial<Record<PromiseDraftField, string>>,
  invalidFields: PromiseDraftField[],
  field: PromiseDraftField,
  result: ValidationResult,
): boolean {
  if (result.valid) return true;
  invalidFields.push(field);
  if (result.message !== null) fields[field] = result.message;
  return false;
}

export function validatePromiseDraft(
  draft: PromiseDraftFields,
  now: Date,
  locale: Locale = 'ko',
): PromiseDraftValidation {
  const fields: Partial<Record<PromiseDraftField, string>> = {};
  const invalidFields: PromiseDraftField[] = [];
  const results = [
    addResult(fields, invalidFields, 'title', validateTitle(draft.title, locale)),
    addResult(fields, invalidFields, 'body', validateBody(draft.body, locale)),
    // 카테고리는 선택 항목이다(PO 2026-08-26, §5-1 개정) — 비워 두면 발송 시 '기타'로 저장된다.
    addResult(
      fields,
      invalidFields,
      'category',
      draft.category === '' ? { valid: true, message: null } : validateCategory(draft.category),
    ),
    addResult(fields, invalidFields, 'end_date', validateEndDate(draft.end_date, now, locale)),
    addResult(fields, invalidFields, 'keeper', validateKeeper(draft.keeper)),
    addResult(fields, invalidFields, 'reward', validateReward(draft.reward)),
    addResult(fields, invalidFields, 'penalty', validatePenalty(draft.penalty)),
  ];

  return { valid: results.every(Boolean), fields, invalidFields };
}

const KOREAN_MOBILE = /01[016789][ -]?\d{3,4}[ -]?\d{4}/u;
const LONG_NUMBER_CANDIDATE = /\d[\d -]{8,24}\d/gu;

export function containsSensitiveNumber(value: string): boolean {
  if (KOREAN_MOBILE.test(value)) return true;

  for (const candidate of value.match(LONG_NUMBER_CANDIDATE) ?? []) {
    const digits = candidate.replace(/\D/gu, '');
    if (digits.length >= 10 && digits.length <= 14) return true;
  }
  return false;
}
