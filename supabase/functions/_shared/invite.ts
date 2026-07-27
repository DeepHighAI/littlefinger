// 초대 토큰의 발급과 응답 조립 — 02 §4-3-1 · §13.
//
// 발급하는 곳이 둘(`promise-create` 의 [상대에게 보내기], `promise-invite` 의 재발송)이라
// 여기 모았다. 중복을 줄이려는 게 아니라 **해시 규칙이 갈라지지 않게** 하려는 것이다 —
// 발급 쪽이 조회 쪽(`lf_invite_resolve`)과 한 글자라도 다르게 해시하면 멀쩡한 링크가 전부
// E_NOT_FOUND 로 죽고, 토큰 원문은 저장되지 않으므로 사후에 원인을 좁힐 방법이 없다.

import { inviteTokenHash } from './hash.ts';
import { createInviteToken } from './token.ts';

export interface IssuedToken {
  /** 응답에 한 번 실리고 사라진다. 로그·RPC 인자·감사 테이블 어디에도 넣지 않는다. */
  token: string;
  /** DB 로 가는 값. `SHA-256(token + pepper)`. */
  hash: string;
}

export async function issueToken(pepper: string): Promise<IssuedToken> {
  const token = createInviteToken();
  return { token, hash: await inviteTokenHash(token, pepper) };
}

/**
 * RPC payload → 클라이언트 응답.
 *
 * RPC 는 자기가 저장한 `token_hash` 를 payload 에 실어 준다. 그 값이 방금 만든 토큰의
 * 해시와 **같을 때만** 원문을 응답에 싣는다.
 *
 * 다를 수 있는 경우는 하나다 — 같은 `Idempotency-Key` 로 두 번 보내면 RPC 가 첫 요청의
 * 결과를 그대로 돌려준다(§7-3.6). 그때 두 번째 요청이 만든 토큰을 실으면 **DB 에 없는
 * 토큰**으로 만든 링크가 사용자에게 가고, 증상은 E_NOT_FOUND 하나뿐이다. 그래서 그 경우엔
 * 아예 싣지 않고, 클라이언트는 먼저 도착한 응답의 토큰을 쓴다(`api.ts` 의 계약).
 *
 * `token_hash` 자체는 언제나 뗀다. 서버 장부일 뿐 클라이언트가 쓸 일이 없다.
 */
export function attachToken(payload: unknown, issued: IssuedToken | null): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return payload;
  }

  const { token_hash: storedHash, ...rest } = payload as Record<string, unknown>;

  return issued !== null && storedHash === issued.hash ? { ...rest, token: issued.token } : rest;
}
