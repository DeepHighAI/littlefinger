// 서버가 원본을 보관하지 않는 값들의 해시 — 02 §13 · 04 §12-8.
//
// 세 가지가 원본 미보관 대상이다: 초대 토큰, IP, User-Agent. §13 수락 기준이 "DB·**로그**
// 어디에도"라고 적었으므로, 원문은 이 파일 밖으로 나가지 않고 로그에도 찍히지 않는다.
//
// `crypto.subtle` 은 웹 표준이라 Deno 와 Node(테스트) 양쪽에서 같은 코드로 돈다.
// Deno 전역을 쓰지 않는 것이 이 파일이 테스트 가능한 이유다.

const encoder = new TextEncoder();

/** 소문자 hex 64자. `lf_content_hash` 와 같은 표현이다(§6). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 초대 토큰 해시 — `SHA-256(token + pepper)` (PO 결정 2026-07-26).
 *
 * `02` §6-2 는 pepper 없는 `SHA-256(token)` 으로 적었으나, 스키마 주석과 `04` §9 가 pepper 를
 * 전제하고 `.env.example` 이 `INVITE_TOKEN_PEPPER` 를 이미 예약해 두었다. PO 가 pepper 쪽으로
 * 확정했고 `02` §6-2 표를 그에 맞춰 정정했다.
 *
 * **발급하는 쪽(T-02)도 반드시 이 함수를 쓴다.** 두 경로가 어긋나면 멀쩡한 링크가 전부
 * `E_NOT_FOUND` 로 죽고 다른 증상이 없어서 원인을 좁힐 단서가 남지 않는다.
 */
export function inviteTokenHash(token: string, pepper: string): Promise<string> {
  return sha256Hex(token + pepper);
}

/**
 * IP·User-Agent 해시 — 04 §12-8 "원본 저장 금지, salt 해시만".
 *
 * salt 는 초대 토큰의 pepper 와 **다른 값**이다. 같은 값을 쓰면 링크 인증용 비밀 하나가
 * 새는 순간 저장된 IP 를 되짚을 수 있는 오라클까지 함께 넘어간다. 분리 비용은 시크릿 한 줄이다.
 */
export function piiHash(value: string, salt: string): Promise<string> {
  return sha256Hex(value + salt);
}
