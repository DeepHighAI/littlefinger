import { describe, expect, test } from 'vitest';

import { completionKeepRateLabel } from './completion-celebration.ts';
import { formatKstDate } from './datetime.ts';
import { ERROR_MESSAGE, ERROR_MESSAGE_BY_LOCALE } from './errors.ts';
import { catalogKeyPaths, LOCALES } from './i18n.ts';
import { LEGAL_DOCUMENT_LABELS, LEGAL_DOCUMENT_LABELS_BY_LOCALE } from './legal.ts';
import {
  KEEPER_LABEL,
  KEEPER_LABEL_BY_LOCALE,
  LEGAL_DISCLAIMER,
  LEGAL_DISCLAIMER_BY_LOCALE,
  PARTICIPANT_ROLE_LABEL,
  PARTICIPANT_ROLE_LABEL_BY_LOCALE,
  PROMISE_CATEGORY_LABEL,
  PROMISE_CATEGORY_LABEL_BY_LOCALE,
  PROMISE_STATUS_LABEL,
  PROMISE_STATUS_LABEL_BY_LOCALE,
} from './promise.ts';
import { validateAmendSuggestion, validateEndDate, validateTitle } from './validation.ts';

/**
 * 공유 라벨 맵의 로케일 쌍 계약: (1) ko 는 기존 상수와 **동일 객체**다 — 서버·기존
 * 호출부의 의미가 변하지 않는다. (2) ko/en 은 키 구조가 완전히 같다.
 */
describe('shared *_BY_LOCALE maps', () => {
  const pairs = [
    ['PROMISE_STATUS_LABEL', PROMISE_STATUS_LABEL, PROMISE_STATUS_LABEL_BY_LOCALE],
    ['PROMISE_CATEGORY_LABEL', PROMISE_CATEGORY_LABEL, PROMISE_CATEGORY_LABEL_BY_LOCALE],
    ['PARTICIPANT_ROLE_LABEL', PARTICIPANT_ROLE_LABEL, PARTICIPANT_ROLE_LABEL_BY_LOCALE],
    ['KEEPER_LABEL', KEEPER_LABEL, KEEPER_LABEL_BY_LOCALE],
    ['LEGAL_DOCUMENT_LABELS', LEGAL_DOCUMENT_LABELS, LEGAL_DOCUMENT_LABELS_BY_LOCALE],
  ] as const;

  test.each(pairs)('%s 의 ko 는 기존 상수 그대로다', (_name, koConst, byLocale) => {
    expect(byLocale.ko).toBe(koConst);
  });

  test.each(pairs)('%s 의 ko/en 키 구조가 같다', (_name, _koConst, byLocale) => {
    for (const locale of LOCALES) {
      expect(catalogKeyPaths(byLocale[locale])).toEqual(catalogKeyPaths(byLocale.ko));
    }
  });

  test('에러 문구도 같은 계약이다 — E_VALIDATION 은 양쪽 다 null', () => {
    expect(ERROR_MESSAGE_BY_LOCALE.ko).toBe(ERROR_MESSAGE);
    expect(Object.keys(ERROR_MESSAGE_BY_LOCALE.en).sort()).toEqual(
      Object.keys(ERROR_MESSAGE).sort(),
    );
    expect(ERROR_MESSAGE_BY_LOCALE.en.E_VALIDATION).toBeNull();
    expect(ERROR_MESSAGE_BY_LOCALE.en.E_WITNESS_LIMIT).toContain('2');
  });

  test('고지 문구 ko·en 모두 확정(법무 검토 완료) — ko 는 확정 문구와 동일 참조다', () => {
    expect(LEGAL_DISCLAIMER_BY_LOCALE.ko).toBe(LEGAL_DISCLAIMER);
    expect(LEGAL_DISCLAIMER_BY_LOCALE.en.length).toBeGreaterThan(0);
  });
});

describe('로케일 파라미터를 받는 공유 함수', () => {
  test('formatKstDate 는 로케일이 바뀌어도 날짜는 KST 그대로, 요일 표기만 바뀐다', () => {
    expect(formatKstDate('2026-08-11')).toBe('2026-08-11 (화)');
    expect(formatKstDate('2026-08-11', 'en')).toBe('2026-08-11 (Tue)');
  });

  test('검증 문구는 로케일을 따르고 기본값은 ko 다 — 서버 재검증 호출부 보호', () => {
    expect(validateTitle('a').message).toBe('제목을 2자 이상 입력해 주세요.');
    expect(validateTitle('a', 'en').message).toBe(
      'Please enter a title of at least 2 characters.',
    );
    expect(validateAmendSuggestion('짧다', 'en').message).toContain('change');
    expect(validateEndDate('bad-date', new Date(), 'en').message).toContain('end date');
  });

  test('completionKeepRateLabel 은 두 로케일에서 같은 사실을 말한다', () => {
    expect(completionKeepRateLabel(80, 85)).toBe('약속 지킴율 80% → 85%');
    expect(completionKeepRateLabel(80, 85, 'en')).toBe('Keep rate 80% → 85%');
    expect(completionKeepRateLabel(null, null, 'en')).toBe('Keep rate: gathering data');
  });
});
