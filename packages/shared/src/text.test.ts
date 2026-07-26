import { describe, expect, test } from 'vitest';

import { codepointLength, normalizeInput } from './text.ts';

// 제어문자는 소스에 리터럴로 박지 않는다. 편집기가 건드리면 조용히 다른 테스트가 된다.
const NUL = String.fromCodePoint(0x00);
const TAB = String.fromCodePoint(0x09);
const CR = String.fromCodePoint(0x0d);
const LF = String.fromCodePoint(0x0a);
const DEL = String.fromCodePoint(0x7f);

// 근거: 02_세부기능명세서 §2-3 입력·검증·에러 표준
describe('normalizeInput', () => {
  test('앞뒤 공백을 제거한다', () => {
    expect(normalizeInput('  매일 30분 걷기  ')).toBe('매일 30분 걷기');
  });

  test('연속 개행 3줄을 2줄로 줄인다', () => {
    expect(normalizeInput('앞\n\n\n뒤')).toBe('앞\n\n뒤');
  });

  test('연속 개행이 더 길어도 2줄로 줄인다', () => {
    expect(normalizeInput('앞\n\n\n\n\n\n뒤')).toBe('앞\n\n뒤');
  });

  test('개행 2줄은 그대로 둔다', () => {
    expect(normalizeInput('앞\n\n뒤')).toBe('앞\n\n뒤');
  });

  test('개행 1줄은 그대로 둔다', () => {
    expect(normalizeInput('앞\n뒤')).toBe('앞\n뒤');
  });

  test('NUL 같은 C0 제어문자를 제거한다', () => {
    expect(normalizeInput(`약${NUL}속기록`)).toBe('약속기록');
  });

  test('DEL 도 제거한다', () => {
    expect(normalizeInput(`약${DEL}속`)).toBe('약속');
  });

  test('CRLF 를 LF 로 만든다', () => {
    expect(normalizeInput(`앞${CR}${LF}뒤`)).toBe(`앞${LF}뒤`);
  });

  test('탭도 제어문자로 보고 제거한다', () => {
    expect(normalizeInput(`앞${TAB}뒤`)).toBe('앞뒤');
  });

  test('제어문자를 지운 뒤에 남는 바깥 공백까지 제거한다', () => {
    expect(normalizeInput(`  ${NUL} 약속 ${NUL}  `)).toBe('약속');
  });

  test('빈 문자열은 빈 문자열이다', () => {
    expect(normalizeInput('')).toBe('');
  });
});

// 한글 조합형 자모 — 일부 IME·클립보드 경로로 이렇게 들어온다.
const JAMO_GA = String.fromCodePoint(0x1100, 0x1161); // ᄀ + ᅡ
const JAMO_GASOK = String.fromCodePoint(0x1100, 0x1161, 0x1109, 0x1169, 0x11a8); // 가속

// 근거: PO 결정(2026-07-26) — NFC 정규화를 적용한다.
// 02 §2-3 은 정규화 형식을 말하지 않았고 04 §7-3 은 content_hash 에만 NFC 를 요구했다.
// 이 결정이 그 공백을 메운다.
describe('normalizeInput — NFC 정규화', () => {
  test('조합형 자모를 완성형 음절로 합친다', () => {
    expect(normalizeInput(JAMO_GA)).toBe('가');
  });

  test('정규화하지 않으면 길이가 부풀어 글자 수 제한이 잘못 걸린다', () => {
    // 이것이 NFC 가 필요한 이유다: 같은 "가속"이 5자로 세어진다.
    expect(codepointLength(JAMO_GASOK)).toBe(5);
    expect(codepointLength(normalizeInput(JAMO_GASOK))).toBe(2);
  });

  test('이미 완성형인 한글은 그대로 둔다', () => {
    expect(normalizeInput('가속')).toBe('가속');
  });

  test('두 번 정규화해도 결과가 같다', () => {
    const once = normalizeInput(JAMO_GASOK);
    expect(normalizeInput(once)).toBe(once);
  });

  test('제어문자가 자모 사이에 끼어 있어도 합쳐진다', () => {
    // 제어문자 제거가 NFC 보다 먼저 와야 성립한다.
    // 순서가 뒤바뀌면 NUL 이 조합을 막아 자모가 분리된 채로 남는다.
    const withControl = String.fromCodePoint(0x1100, 0x00, 0x1161);
    expect(normalizeInput(withControl)).toBe('가');
  });

  test('ZWJ 이모지 시퀀스는 건드리지 않는다', () => {
    const family = '👨‍👩‍👧';
    expect(normalizeInput(family)).toBe(family);
  });
});

// 근거: 02_세부기능명세서 §2-3 "글자 수는 유니코드 코드포인트 기준(이모지 1자 처리)"
describe('codepointLength', () => {
  test('한글은 글자 수 그대로 센다', () => {
    expect(codepointLength('약속')).toBe(2);
  });

  test('이모지 하나를 1자로 센다', () => {
    // '👍'.length 는 2 (서로게이트 쌍). 코드포인트 기준이면 1이어야 한다.
    expect(codepointLength('👍')).toBe(1);
  });

  test('이모지가 섞여도 코드포인트로 센다', () => {
    expect(codepointLength('약속👍')).toBe(3);
  });

  test('빈 문자열은 0이다', () => {
    expect(codepointLength('')).toBe(0);
  });
});
