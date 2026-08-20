import type {
  ErrorCode,
  InvitePreviewResponse,
  InviteResolveResponse,
} from '@littlefinger/shared';

/**
 * 앱 내 초대 검토(EC-I01)의 단계 판정 — 순수 함수만.
 *
 * 웹의 SCR-W01→W02 흐름을 한 라우트가 이어받는다: resolve(공개) → 비로그인 랜딩 또는
 * preview(인증) → 검토 → 승인/거절/수정 제안. 증인 토큰은 웹 SCR-W05 로 핸드오프한다 —
 * 증인 참여·서명 UI 는 웹이 이미 완성돼 있고, 앱 이식은 별도 범위다(ADR 0007).
 */

/** 웹 SCR-W06 과 같은 다섯 사유 — 링크가 죽었다는 뜻인 코드만 여기로 온다. */
export type InviteUnavailableReason = Extract<
  ErrorCode,
  'E_INVITE_EXPIRED' | 'E_INVITE_USED' | 'E_INVITE_REVOKED' | 'E_BLOCKED' | 'E_NOT_FOUND'
>;

const UNAVAILABLE_REASONS: readonly string[] = [
  'E_INVITE_EXPIRED',
  'E_INVITE_USED',
  'E_INVITE_REVOKED',
  'E_BLOCKED',
  'E_NOT_FOUND',
];

export function isInviteUnavailableReason(code: string): code is InviteUnavailableReason {
  return UNAVAILABLE_REASONS.includes(code);
}

export type InviteReviewPhase =
  | { kind: 'RESOLVING' }
  /** 비로그인 — 최소 정보(§4-3-3)와 로그인 버튼만 보인다. 토큰은 라우트를 떠나지 않는다. */
  | { kind: 'LANDING'; invite: InviteResolveResponse }
  /** 증인 토큰 — 웹 SCR-W05 로 이어 준다. */
  | { kind: 'HANDOFF'; invite: InviteResolveResponse }
  | { kind: 'REVIEW_LOADING'; invite: InviteResolveResponse }
  | { kind: 'REVIEW'; invite: InviteResolveResponse; preview: InvitePreviewResponse }
  /** 거절·수정 제안 종결 — 웹 `/responded/:outcome` 의 앱 등가물. 승인은 상세로 이동한다. */
  | { kind: 'DONE'; outcome: 'DECLINED' | 'AMEND_SUGGESTED' }
  /** 작성자가 자기 링크를 연 경우(EC-B05). 링크가 죽은 것이 아니라 사람이 다르다. */
  | { kind: 'SELF_INVITE' }
  | { kind: 'UNAVAILABLE'; reason: InviteUnavailableReason }
  | { kind: 'RETRY'; message: string };

export function phaseAfterResolve(
  invite: InviteResolveResponse,
  hasSession: boolean,
): InviteReviewPhase {
  if (invite.target_role === 'WITNESS') return { kind: 'HANDOFF', invite };
  return hasSession
    ? { kind: 'REVIEW_LOADING', invite }
    : { kind: 'LANDING', invite };
}

export function phaseForInviteFailure(
  code: ErrorCode | null,
  message: string,
): InviteReviewPhase {
  if (code === 'E_SELF_INVITE') return { kind: 'SELF_INVITE' };
  if (code !== null && isInviteUnavailableReason(code)) {
    return { kind: 'UNAVAILABLE', reason: code };
  }
  return { kind: 'RETRY', message };
}
