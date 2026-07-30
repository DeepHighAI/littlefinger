import type { PromiseInviteResponse } from '@littlefinger/shared';

export type InviteWithToken = PromiseInviteResponse & { token: string };

interface EncryptedItemStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function inviteKey(userId: string, promiseId: string): string {
  return `lf.invite.${userId}.${promiseId}`;
}

function hasToken(invite: PromiseInviteResponse): invite is InviteWithToken {
  return typeof invite.token === 'string' && invite.token.length > 0;
}

export class InviteRepository {
  constructor(private readonly store: EncryptedItemStore) {}

  async load(userId: string, promiseId: string): Promise<InviteWithToken | null> {
    const value = await this.store.getItem(inviteKey(userId, promiseId));
    if (value === null) return null;
    try {
      const invite = JSON.parse(value) as PromiseInviteResponse;
      if (invite.promise_id === promiseId && hasToken(invite)) return invite;
    } catch {
      // 손상된 암호문은 아래에서 제거한다. 토큰을 추측해 복구하지 않는다.
    }
    await this.remove(userId, promiseId);
    return null;
  }

  async save(userId: string, invite: InviteWithToken): Promise<void> {
    await this.store.setItem(
      inviteKey(userId, invite.promise_id),
      JSON.stringify(invite),
    );
  }

  async remove(userId: string, promiseId: string): Promise<void> {
    await this.store.removeItem(inviteKey(userId, promiseId));
  }
}

export function buildInviteLink(webBaseUrl: string, token: string): string {
  const base = webBaseUrl.replace(/\/+$/u, '');
  if (!base.startsWith('https://') || token.length === 0) {
    throw new Error('초대 링크 설정을 확인해 주세요.');
  }
  return `${base}/i/${encodeURIComponent(token)}`;
}

export function inviteShareMessage(title: string, link: string): string {
  return `${title}\n${link}`;
}

export function inviteRemainingSeconds(expiresAt: string, now: Date): number {
  const remainingMs = Date.parse(expiresAt) - now.getTime();
  if (!Number.isFinite(remainingMs)) return 0;
  return Math.max(0, Math.ceil(remainingMs / 1_000));
}

export function isInviteExpired(expiresAt: string, now: Date): boolean {
  return inviteRemainingSeconds(expiresAt, now) === 0;
}

export function formatInviteCountdown(expiresAt: string, now: Date): string {
  const remaining = inviteRemainingSeconds(expiresAt, now);
  const hours = Math.floor(remaining / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  const seconds = remaining % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export async function ensureInviteToken(
  response: PromiseInviteResponse,
  issue: (promiseId: string) => Promise<PromiseInviteResponse>,
): Promise<InviteWithToken> {
  if (hasToken(response)) return response;
  const issued = await issue(response.promise_id);
  if (!hasToken(issued)) throw new Error('초대 링크를 새로 만들지 못했어요.');
  return issued;
}
