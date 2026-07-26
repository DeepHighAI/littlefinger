/**
 * 사용자 입력 정규화 — 02_세부기능명세서 §2-3.
 *
 * 검증(§5)은 반드시 정규화 뒤에 돈다. 그래야 "  약  " 같은 입력이
 * 길이 제한을 통과하는 일이 없다.
 */

const LF = 0x0a;
const C0_MAX = 0x1f;
const DEL = 0x7f;
const C1_MAX = 0x9f;

/**
 * 제어문자 판정. 개행만 남긴다 — 약속 내용(§5-1 body)은 개행을 허용하기 때문이다.
 * CR 은 제어문자로 걸려 사라지므로 CRLF 입력이 자연히 LF 가 된다.
 *
 * 정규식 문자 클래스 대신 코드포인트로 판정한다. 소스에 리터럴 제어문자를 박으면
 * 편집기·포매터가 건드릴 때 조용히 깨진다.
 */
function isControlExceptLf(codePoint: number): boolean {
  if (codePoint === LF) return false;
  return codePoint <= C0_MAX || (codePoint >= DEL && codePoint <= C1_MAX);
}

/** 3줄 이상 연속된 개행 */
const THREE_OR_MORE_NEWLINES = /\n{3,}/gu;

export function normalizeInput(value: string): string {
  const withoutControls = [...value]
    .filter((char) => !isControlExceptLf(char.codePointAt(0) ?? 0))
    .join('');

  return withoutControls.replace(THREE_OR_MORE_NEWLINES, '\n\n').trim();
}

/**
 * 유니코드 코드포인트 기준 길이.
 * `String.length` 는 서로게이트 쌍을 2로 세므로 이모지가 2자로 잡힌다.
 */
export function codepointLength(value: string): number {
  return [...value].length;
}
