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

/**
 * 순서가 중요하다.
 *
 * 1. 제어문자 제거 — **NFC 보다 먼저.** 자모 사이에 낀 제어문자가 조합을 막기 때문이다.
 *    (`ᄀ` + NUL + `ᅡ` 는 NFC 를 먼저 돌리면 `가` 로 합쳐지지 않는다.)
 * 2. NFC 정규화 — PO 결정(2026-07-26). 한글 조합형 자모를 완성형 음절로 합친다.
 *    이걸 건너뛰면 같은 "가속"이 2자가 아니라 5자로 세어져 글자 수 제한이 잘못 걸린다.
 * 3. 개행 축약, 4. trim.
 *
 * **NFKC·NFKD 를 쓰지 않는다.** Hermes(안드로이드)에서 프로세스가 죽고 try/catch 로도 잡히지
 * 않는다(RN #28698 · #37671). 호환 자모(U+3131 ㄱ 등)를 합치고 싶어서 NFKC 로 손이 갈 텐데,
 * 그러면 잡을 수 없는 안드로이드 크래시를 출하하게 된다.
 *
 * 또 하나: NFC 는 길이를 **늘릴 수도** 있다(U+0958 → 2 코드포인트). "정규화하면 짧아지니
 * 원본 길이로 미리 걸러도 된다"는 최적화는 틀렸다 — 길이는 반드시 정규화 뒤에만 센다.
 *
 * 적용 대상은 **사용자가 쓴 텍스트뿐**이다. 스토리지 키·초대 토큰·해시는 불투명한 바이트로
 * 다루고 이 함수에 넣지 않는다 — 정규화된 키로 조회하면 객체를 못 찾는다.
 */
export function normalizeInput(value: string): string {
  const withoutControls = [...value]
    .filter((char) => !isControlExceptLf(char.codePointAt(0) ?? 0))
    .join('');

  return withoutControls.normalize('NFC').replace(THREE_OR_MORE_NEWLINES, '\n\n').trim();
}

/**
 * 유니코드 코드포인트 기준 길이.
 * `String.length` 는 서로게이트 쌍을 2로 세므로 이모지가 2자로 잡힌다.
 */
export function codepointLength(value: string): number {
  return [...value].length;
}
