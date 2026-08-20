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
  end_date: string;
  keeper: Keeper;
  reward: string;
  penalty: string;
  witness_enabled: boolean;
}

export type PromiseDraftField = keyof PromiseDraftFields;

export interface PromiseDraftValidation {
  valid: boolean;
  fields: Partial<Record<PromiseDraftField, string>>;
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
  ],
  en: [
    'A coffee treat',
    'Pick the next menu',
    'One wish coupon',
    'Decide the weekend plan',
    'Three compliments',
  ],
};

const PENALTY_PRESETS_BY_LOCALE: Localized<readonly string[]> = {
  ko: [
    '커피 한 잔 사기',
    '설거지 1주일',
    '다음 데이트 비용',
    '노래방 한 곡',
    '소원권 1장 주기',
  ],
  en: [
    'Buy a coffee',
    'Dishes for a week',
    'Pay for the next date',
    'Sing one karaoke song',
    'Give one wish coupon',
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
  field: PromiseDraftField,
  result: ValidationResult,
): boolean {
  if (result.valid) return true;
  if (result.message !== null) fields[field] = result.message;
  return false;
}

export function validatePromiseDraft(
  draft: PromiseDraftFields,
  now: Date,
  locale: Locale = 'ko',
): PromiseDraftValidation {
  const fields: Partial<Record<PromiseDraftField, string>> = {};
  const results = [
    addResult(fields, 'title', validateTitle(draft.title, locale)),
    addResult(fields, 'body', validateBody(draft.body, locale)),
    addResult(fields, 'category', validateCategory(draft.category)),
    addResult(fields, 'end_date', validateEndDate(draft.end_date, now, locale)),
    addResult(fields, 'keeper', validateKeeper(draft.keeper)),
    addResult(fields, 'reward', validateReward(draft.reward)),
    addResult(fields, 'penalty', validatePenalty(draft.penalty)),
  ];

  return { valid: results.every(Boolean), fields };
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
