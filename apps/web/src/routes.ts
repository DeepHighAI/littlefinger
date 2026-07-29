/**
 * 수락 웹의 경로표.
 *
 * 초대 링크는 `https://littlefinger.pages.dev/i/{token}` 이다(PO 2026-07-27, C-3 종결).
 * **이 형태는 바꿀 수 없다** — 서버는 발송한 URL 을 기록하지 않고 토큰은 72시간 살아 있어서,
 * 경로가 달라지면 이미 카카오톡에 뿌려진 링크를 찾을 방법도 되살릴 방법도 없다.
 */
export const ROUTE = {
  /** SCR-W01 초대 랜딩. 로그인 **전** 화면이다(§4-3-3). */
  invite: '/i/:token',
  /** 카카오 로그인이 돌아오는 자리. Supabase 리다이렉트 허용목록에 등록된 경로다. */
  authCallback: '/auth/callback',
} as const;

export function invitePath(token: string): string {
  return `/i/${encodeURIComponent(token)}`;
}
