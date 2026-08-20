import { describe, expect, test } from 'vitest';

import {
  DEFAULT_LOCALE,
  LOCALES,
  catalogKeyPaths,
  resolveLocale,
  type Localized,
} from './i18n.ts';

describe('resolveLocale', () => {
  test('한국어 태그는 지역 변형과 대소문자를 가리지 않고 ko 다', () => {
    expect(resolveLocale(['ko'])).toBe('ko');
    expect(resolveLocale(['ko-KR'])).toBe('ko');
    expect(resolveLocale(['KO-kr', 'en-US'])).toBe('ko');
  });

  test('한국어가 아닌 첫 태그는 전부 en 이다 (PO 2026-08-20)', () => {
    expect(resolveLocale(['en-US'])).toBe('en');
    expect(resolveLocale(['ja-JP', 'ko-KR'])).toBe('en');
    expect(resolveLocale(['fr'])).toBe('en');
  });

  test('판정 불가면 기본 로케일이다', () => {
    expect(resolveLocale([])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(['', '  '])).toBe(DEFAULT_LOCALE);
  });

  test('빈 태그는 건너뛰고 첫 실태그로 판정한다', () => {
    expect(resolveLocale(['', 'ko-KR'])).toBe('ko');
    expect(resolveLocale(['', 'en-US'])).toBe('en');
  });

  // "korean" 같은 이름이 ko 접두 매칭에 걸리면 안 된다 — 태그 구분자를 본다.
  test('ko 는 태그 경계로만 매칭한다', () => {
    expect(resolveLocale(['kok-IN'])).toBe('en');
  });
});

describe('catalogKeyPaths', () => {
  test('중첩 키 경로를 정렬해 나열한다 — 함수·문자열·배열이 리프다', () => {
    const catalog = {
      title: '제목',
      counts: { partner: (n: number) => `${n}명`, witness: '증인' },
      lines: ['a', 'b'],
    };
    expect(catalogKeyPaths(catalog)).toEqual([
      'counts.partner',
      'counts.witness',
      'lines',
      'title',
    ]);
  });

  test('ko/en 구조 비교에 쓰인다', () => {
    const ko = { a: '가', b: { c: (n: number) => `${n}` } };
    const en = { a: 'a', b: { c: (n: number) => `${n}` } } satisfies typeof ko;
    const catalog: Localized<typeof ko> = { ko, en };
    expect(LOCALES.every((locale) =>
      catalogKeyPaths(catalog[locale]).join('|') === catalogKeyPaths(catalog.ko).join('|'),
    )).toBe(true);
  });
});
