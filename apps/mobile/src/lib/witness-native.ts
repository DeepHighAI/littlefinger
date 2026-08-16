import {
  asWitnessInviteResponse,
  type WitnessInviteListResponse,
  type WitnessInviteResponse,
} from '@littlefinger/shared';
import { Share } from 'react-native';

import { buildInviteLink, inviteShareMessage } from './invite-flow.ts';
import { callMobileFunctionNative, currentMobileUserId } from './mobile-api-native.ts';
import { getMobileEncryptedStorage } from './supabase-native.ts';
import { issueWitnessInviteWith, listWitnessesWith } from './witness-api.ts';

interface EncryptedItemStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type WitnessInviteWithToken = WitnessInviteResponse & { token: string };

function hasToken(invite: WitnessInviteResponse): invite is WitnessInviteWithToken {
  return typeof invite.token === 'string' && invite.token.length > 0;
}

export function witnessInviteStorageKey(
  userId: string,
  promiseId: string,
  participantId: string,
): string {
  return `witness-invite:${userId}:${promiseId}:${participantId}`;
}

export class WitnessInviteRepository {
  constructor(private readonly store: EncryptedItemStore) {}

  async load(
    userId: string,
    promiseId: string,
    participantId: string,
  ): Promise<WitnessInviteWithToken | null> {
    const key = witnessInviteStorageKey(userId, promiseId, participantId);
    const value = await this.store.getItem(key);
    if (value === null) return null;
    try {
      const parsed = asWitnessInviteResponse(JSON.parse(value));
      if (
        parsed !== null
        && parsed.promise_id === promiseId
        && parsed.participant_id === participantId
        && hasToken(parsed)
      ) return parsed;
    } catch {
      // 손상된 암호문은 토큰을 추측하지 않고 폐기한다.
    }
    await this.store.removeItem(key);
    return null;
  }

  async save(userId: string, invite: WitnessInviteWithToken): Promise<void> {
    await this.store.setItem(
      witnessInviteStorageKey(userId, invite.promise_id, invite.participant_id),
      JSON.stringify(invite),
    );
  }

  async remove(userId: string, promiseId: string, participantId: string): Promise<void> {
    await this.store.removeItem(witnessInviteStorageKey(userId, promiseId, participantId));
  }
}

type IssueWitness = (
  promiseId: string,
  participantId: string | null,
) => Promise<WitnessInviteResponse>;

export async function ensureWitnessInvite(
  userId: string,
  promiseId: string,
  participantId: string | null,
  repository: WitnessInviteRepository,
  issue: IssueWitness,
): Promise<WitnessInviteWithToken> {
  if (participantId !== null) {
    const stored = await repository.load(userId, promiseId, participantId);
    if (stored !== null) return stored;
  }

  const issued = await issue(promiseId, participantId);
  if (hasToken(issued)) {
    await repository.save(userId, issued);
    return issued;
  }

  const replayed = await repository.load(userId, promiseId, issued.participant_id);
  if (replayed !== null) return replayed;

  const replacement = await issue(promiseId, issued.participant_id);
  if (!hasToken(replacement)) throw new Error('WITNESS_INVITE_TOKEN_UNAVAILABLE');
  await repository.save(userId, replacement);
  return replacement;
}

const apiDeps = { call: callMobileFunctionNative };

function repository(): WitnessInviteRepository {
  return new WitnessInviteRepository(getMobileEncryptedStorage());
}

export async function listWitnesses(promiseId: string): Promise<WitnessInviteListResponse> {
  return await listWitnessesWith(promiseId, apiDeps);
}

export async function loadWitnessInvite(
  promiseId: string,
  participantId: string,
): Promise<WitnessInviteWithToken | null> {
  return await repository().load(await currentMobileUserId(), promiseId, participantId);
}

export async function issueWitnessInvite(
  promiseId: string,
  participantId: string | null = null,
): Promise<WitnessInviteWithToken> {
  return await ensureWitnessInvite(
    await currentMobileUserId(),
    promiseId,
    participantId,
    repository(),
    async (targetPromiseId, targetParticipantId) =>
      await issueWitnessInviteWith(targetPromiseId, targetParticipantId, apiDeps),
  );
}

export async function shareWitnessInvite(invite: WitnessInviteWithToken): Promise<void> {
  const link = buildInviteLink(process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '', invite.token);
  await Share.share({ message: inviteShareMessage(invite.title, link) });
}
