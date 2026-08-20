import * as Crypto from 'expo-crypto';

import {
  approveInvite,
  declineInvite,
  previewInvite,
  resolveInvite,
  suggestInviteAmend,
  type InviteReviewApiDeps,
} from './invite-review-api.ts';
import {
  callMobileFunctionNative,
  callMobileFunctionPublicNative,
} from './mobile-api-native.ts';
import { getMobileSupabaseClient } from './supabase-native.ts';

import type {
  InvitePreviewResponse,
  InviteResolveResponse,
  PromiseApproveResponse,
} from '@littlefinger/shared';

const deps: InviteReviewApiDeps = {
  call: callMobileFunctionNative,
  callPublic: callMobileFunctionPublicNative,
};

export async function resolveInviteNative(token: string): Promise<InviteResolveResponse> {
  return await resolveInvite(token, deps);
}

export async function previewInviteNative(token: string): Promise<InvitePreviewResponse> {
  return await previewInvite(token, deps);
}

export async function approveInviteNative(
  token: string,
  idempotencyKey: string,
): Promise<PromiseApproveResponse> {
  return await approveInvite(token, idempotencyKey, deps);
}

export async function declineInviteNative(
  token: string,
  reason: string,
  idempotencyKey: string,
): Promise<void> {
  await declineInvite(token, reason, idempotencyKey, deps);
}

export async function suggestInviteAmendNative(
  token: string,
  comment: string,
  idempotencyKey: string,
): Promise<void> {
  await suggestInviteAmend(token, comment, idempotencyKey, deps);
}

export function createInviteReviewIdempotencyKey(): string {
  return Crypto.randomUUID();
}

/**
 * 세션 유무를 즉시 한 번 + 변할 때마다 알려 준다. 이 라우트는 인증 가드 밖에 있어
 * (_layout: `/i/` 예외) 로그인 후에도 같은 화면에 머무르므로, 세션 등장을 직접 들어야
 * 랜딩 → 검토로 넘어갈 수 있다.
 */
export function watchMobileSession(listener: (hasSession: boolean) => void): () => void {
  const client = getMobileSupabaseClient();
  void client.auth
    .getSession()
    .then(({ data, error }) => listener(error === null && data.session !== null))
    .catch(() => listener(false));
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    listener(session !== null);
  });
  return () => data.subscription.unsubscribe();
}
