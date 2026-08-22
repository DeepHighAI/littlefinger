import {
  ENDPOINT,
  type InviteRevokeResponse,
  type PromiseInviteResponse,
} from '@littlefinger/shared';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

import {
  InviteRepository,
  buildInviteLink,
  ensureInviteToken,
  inviteShareMessage,
  type InviteWithToken,
} from './invite-flow.ts';
import {
  callMobileFunctionNative,
  currentMobileUserId,
} from './mobile-api-native.ts';
import { getMobileEncryptedStorage } from './supabase-native.ts';

function repository(): InviteRepository {
  return new InviteRepository(getMobileEncryptedStorage());
}

async function issue(promiseId: string): Promise<PromiseInviteResponse> {
  return await callMobileFunctionNative(
    ENDPOINT.promiseInvite,
    { promise_id: promiseId },
    { idempotent: true },
  );
}

export async function loadStoredInvite(
  promiseId: string,
): Promise<InviteWithToken | null> {
  return await repository().load(await currentMobileUserId(), promiseId);
}

export async function reissueInvite(promiseId: string): Promise<InviteWithToken> {
  const invite = await ensureInviteToken(await issue(promiseId), issue);
  await repository().save(await currentMobileUserId(), invite);
  return invite;
}

export async function revokeInvite(promiseId: string): Promise<void> {
  await callMobileFunctionNative<InviteRevokeResponse>(
    ENDPOINT.inviteRevoke,
    { promise_id: promiseId },
    { idempotent: true },
  );
  await repository().remove(await currentMobileUserId(), promiseId);
}

export async function shareInvite(invite: InviteWithToken): Promise<void> {
  const link = buildInviteLink(
    process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '',
    invite.token,
  );
  await Share.share({
    title: invite.title,
    message: inviteShareMessage(invite.title, link),
  });
}

// 공유 시트와 달리 **링크만** 담는다(PO 2026-08-23) — 메시지 문구까지 복사되면
// 붙여넣는 곳(SMS·DM)에서 이중 인사말이 된다.
export async function copyInviteLink(invite: InviteWithToken): Promise<void> {
  const link = buildInviteLink(
    process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '',
    invite.token,
  );
  await Clipboard.setStringAsync(link);
}
