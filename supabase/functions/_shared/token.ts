// 초대 토큰 생성 — 02 §4-3-1 "32바이트 CSPRNG → URL-safe Base64".
//
// **원문 토큰이 존재하는 유일한 곳이 이 함수의 반환값이다.** DB 에는 해시만 들어가고(§13),
// 응답에 한 번 실린 뒤로는 아무도 되찾을 수 없다. 그래서 로그·RPC 인자·감사 테이블 어디에도
// 흘리지 않는다 — 흘리면 되돌릴 방법이 없다.
//
// `crypto.getRandomValues` 는 웹 표준이라 Deno 와 Node(테스트) 양쪽에서 같은 코드로 돈다.
// Deno 전역을 쓰지 않는 것이 이 파일이 테스트 가능한 이유다.

const TOKEN_BYTES = 32;

/**
 * URL-safe Base64 (RFC 4648 §5). 패딩 `=` 은 뗀다.
 *
 * 표준 Base64 를 그대로 쓰면 `+` 와 `/` 가 들어가고, 토큰은 `https://{web}/i/{token}` 의
 * 경로 조각이 된다 — `/` 는 경로를 갈라 버리고 `+` 는 디코더에 따라 공백이 된다.
 * 그러면 링크는 열리는데 조회용 해시만 달라져서 E_NOT_FOUND 로 죽는다.
 */
function toUrlSafeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createInviteToken(): string {
  return toUrlSafeBase64(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}
