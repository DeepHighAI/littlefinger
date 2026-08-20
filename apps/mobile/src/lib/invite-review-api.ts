import {
  ENDPOINT,
  type Endpoint,
  type InvitePreviewResponse,
  type InviteResolveResponse,
  type InviteTokenRequest,
  type PromiseAmendRequest,
  type PromiseApproveResponse,
  type PromiseDeclineRequest,
} from '@littlefinger/shared';

import { MobileApiError } from './mobile-api.ts';

import type { MobileApiOptions } from './mobile-api.ts';

/**
 * 앱 내 초대 검토가 부르는 다섯 엔드포인트 — 웹 SCR-W01/W02 와 같은 계약이다.
 * resolve 만 공개 호출(비로그인)이고 나머지 넷은 세션이 필요하다.
 */
export interface InviteReviewApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
  callPublic<T>(endpoint: Endpoint, body: unknown): Promise<T>;
}

const MALFORMED_MESSAGE = '문제가 발생했어요. 잠시 후 다시 시도해 주세요.';

/**
 * 200 이라도 형태까지 보장되지는 않는다 — 어긋난 채 그리면 크래시 없이 빈 헤드라인과
 * NaN 카운트다운이 나온다(웹 SCR-W01 과 같은 이유). 공개 엔드포인트라 더 엄격히 본다.
 */
function parseResolveResponse(body: unknown): InviteResolveResponse | null {
  if (typeof body !== 'object' || body === null) return null;
  const { creator_nickname, title, expires_at, target_role } = body as Record<string, unknown>;
  if (
    typeof creator_nickname !== 'string' ||
    typeof title !== 'string' ||
    typeof expires_at !== 'string' ||
    (target_role !== 'PARTNER' && target_role !== 'WITNESS')
  ) {
    return null;
  }
  return { creator_nickname, title, expires_at, target_role };
}

export async function resolveInvite(
  token: string,
  deps: InviteReviewApiDeps,
): Promise<InviteResolveResponse> {
  const body = await deps.callPublic<unknown>(ENDPOINT.inviteResolve, {
    token,
  } satisfies InviteTokenRequest);
  const invite = parseResolveResponse(body);
  if (invite === null) throw new MobileApiError(null, MALFORMED_MESSAGE);
  return invite;
}

export async function previewInvite(
  token: string,
  deps: InviteReviewApiDeps,
): Promise<InvitePreviewResponse> {
  return await deps.call(
    ENDPOINT.invitePreview,
    { token } satisfies InviteTokenRequest,
    { idempotent: false },
  );
}

export async function approveInvite(
  token: string,
  idempotencyKey: string,
  deps: InviteReviewApiDeps,
): Promise<PromiseApproveResponse> {
  return await deps.call(
    ENDPOINT.promiseApprove,
    { token } satisfies InviteTokenRequest,
    { idempotencyKey },
  );
}

export async function declineInvite(
  token: string,
  reason: string,
  idempotencyKey: string,
  deps: InviteReviewApiDeps,
): Promise<void> {
  const body: PromiseDeclineRequest = { token };
  // §5-3: 사유는 선택이다. 빈 문자열을 보내면 0자 사유가 "있는" 것으로 저장된다.
  if (reason.trim().length > 0) body.reason = reason.trim();
  await deps.call(ENDPOINT.promiseDecline, body, { idempotencyKey });
}

export async function suggestInviteAmend(
  token: string,
  comment: string,
  idempotencyKey: string,
  deps: InviteReviewApiDeps,
): Promise<void> {
  await deps.call(
    ENDPOINT.promiseAmend,
    { token, comment } satisfies PromiseAmendRequest,
    { idempotencyKey },
  );
}
