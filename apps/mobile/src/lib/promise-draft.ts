import {
  validateBody,
  validateCategory,
  validateEndDate,
  validateKeeper,
  validatePenalty,
  validateReward,
  validateTitle,
  type Keeper,
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

export const REWARD_PRESETS = [
  '커피 한 잔 사주기',
  '다음 메뉴 선택권',
  '소원권 1장',
  '주말 계획 결정권',
  '칭찬 세 가지',
] as const;

export const PENALTY_PRESETS = [
  '커피 한 잔 사기',
  '설거지 1주일',
  '다음 데이트 비용',
  '노래방 한 곡',
  '소원권 1장 주기',
] as const;

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
): PromiseDraftValidation {
  const fields: Partial<Record<PromiseDraftField, string>> = {};
  const results = [
    addResult(fields, 'title', validateTitle(draft.title)),
    addResult(fields, 'body', validateBody(draft.body)),
    addResult(fields, 'category', validateCategory(draft.category)),
    addResult(fields, 'end_date', validateEndDate(draft.end_date, now)),
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
