import {
  ENDPOINT,
  type InviteRevokeResponse,
  type PromiseInviteResponse,
} from '@littlefinger/shared';
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
