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
  /**
   * 거절 · 수정 제안 종결(§4-3-4 의 나머지 두 갈래).
   *
   * SCR-ID 가 없어서 경로도 하는 일로 지었다. 결과를 **경로**에 담는 이유는 라우터 state 가
   * 새로고침에 사라지기 때문이다 — 그 순간 초대는 이미 USED 라, state 가 비면 다시 그릴
   * 근거가 어디에도 없다(SCR-W03 이 실제로 그렇다).
   */
  responseComplete: '/i/:token/responded/:outcome',
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

/** 종결 화면이 어느 응답의 결과인지. 두 값 각각에 PO 승인 문구가 하나씩 붙는다. */
export const RESPONSE_OUTCOME = {
  declined: 'declined',
  amendSuggested: 'amend-suggested',
} as const;

export type ResponseOutcome = (typeof RESPONSE_OUTCOME)[keyof typeof RESPONSE_OUTCOME];

export function isResponseOutcome(value: string | undefined): value is ResponseOutcome {
  return value === RESPONSE_OUTCOME.declined || value === RESPONSE_OUTCOME.amendSuggested;
}

export function responseCompletePath(token: string, outcome: ResponseOutcome): string {
  return `${invitePath(token)}/responded/${outcome}`;
}
