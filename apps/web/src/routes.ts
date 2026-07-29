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
  /** SCR-W02 약속 검토. 로그인 **후**에만 열린다(§4-3-4). */
  review: '/i/:token/review',
  /** SCR-W03 승인 완료(§4-4-4). */
  approvalComplete: '/i/:token/done',
  /** 카카오 로그인이 돌아오는 자리. Supabase 리다이렉트 허용목록에 등록된 경로다. */
  authCallback: '/auth/callback',
} as const;

export function invitePath(token: string): string {
  return `/i/${encodeURIComponent(token)}`;
}

// 검토·완료는 초대 경로 **아래**에 둔다. 로그인은 `/i/{token}` 으로만 돌아오므로(§4-3-3)
// 토큰이 살아 있는 경로는 이 하나뿐이고, 그 아래에 붙여야 화면을 옮겨도 토큰이 남는다.
export function reviewPath(token: string): string {
  return `${invitePath(token)}/review`;
}

export function approvalCompletePath(token: string): string {
  return `${invitePath(token)}/done`;
}
