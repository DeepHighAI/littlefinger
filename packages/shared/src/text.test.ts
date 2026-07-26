import { describe, expect, test } from 'vitest';

import { codepointLength, normalizeInput } from './text.js';

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
