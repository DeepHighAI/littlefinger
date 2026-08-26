import { Share } from 'react-native';

import type { WitnessInviteResponse } from '@littlefinger/shared';

jest.mock('./mobile-api-native.ts', () => ({
  callMobileFunctionNative: jest.fn(),
  currentMobileUserId: jest.fn(),
}));
jest.mock('./supabase-native.ts', () => ({
  getMobileEncryptedStorage: jest.fn(),
}));

import {
  WitnessInviteRepository,
  ensureWitnessInvite,
  shareWitnessInvite,
  witnessInviteStorageKey,
} from './witness-native.ts';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const PROMISE_ID = '33333333-3333-4333-8333-333333333333';
const PARTICIPANT_ID = '44444444-4444-4444-8444-444444444444';
const INVITATION_ID = '55555555-5555-4555-8555-555555555555';

const invite: WitnessInviteResponse & { token: string } = {
  promise_id: PROMISE_ID,
  participant_id: PARTICIPANT_ID,
  invitation_id: INVITATION_ID,
  title: '매일 걷기',
  expires_at: '2026-08-20T00:00:00Z',
  token: 'A'.repeat(43),
};

function storeSpy() {
  const values = new Map<string, string>();
  const removed: string[] = [];
  return {
    values,
    removed,
    store: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => { values.set(key, value); },
      removeItem: async (key: string) => { removed.push(key); values.delete(key); },
    },
  };
}

describe('encrypted witness invite token lifecycle', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://littlefinger-app.web.app';
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  });

  afterEach(() => jest.restoreAllMocks());

  test('key is scoped by user promise and participant', () => {
    expect(witnessInviteStorageKey(USER_A, PROMISE_ID, PARTICIPANT_ID)).toBe(
      `witness-invite:${USER_A}:${PROMISE_ID}:${PARTICIPANT_ID}`,
    );
    expect(witnessInviteStorageKey(USER_A, PROMISE_ID, PARTICIPANT_ID)).not.toBe(
      witnessInviteStorageKey(USER_B, PROMISE_ID, PARTICIPANT_ID),
    );
  });

  test('repository restores only the same user promise and participant token', async () => {
    const s = storeSpy();
    const repository = new WitnessInviteRepository(s.store);
    await repository.save(USER_A, invite);
    await expect(repository.load(USER_A, PROMISE_ID, PARTICIPANT_ID)).resolves.toEqual(invite);
    await expect(repository.load(USER_B, PROMISE_ID, PARTICIPANT_ID)).resolves.toBeNull();
  });

  test('corrupt or cross-slot payload is deleted rather than guessed', async () => {
    const s = storeSpy();
    const repository = new WitnessInviteRepository(s.store);
    const key = witnessInviteStorageKey(USER_A, PROMISE_ID, PARTICIPANT_ID);
    s.values.set(key, JSON.stringify({ ...invite, participant_id: USER_B }));
    await expect(repository.load(USER_A, PROMISE_ID, PARTICIPANT_ID)).resolves.toBeNull();
    expect(s.removed).toEqual([key]);
  });

  test('same-token replay uses encrypted storage without issuing again', async () => {
    const s = storeSpy();
    const repository = new WitnessInviteRepository(s.store);
    await repository.save(USER_A, invite);
    const issue = jest.fn();
    await expect(
      ensureWitnessInvite(USER_A, PROMISE_ID, PARTICIPANT_ID, repository, issue),
    ).resolves.toEqual(invite);
    expect(issue).not.toHaveBeenCalled();
  });

  test('missing token reissues the same slot and stores replacement before returning', async () => {
    const s = storeSpy();
    const repository = new WitnessInviteRepository(s.store);
    const replacement = { ...invite, invitation_id: USER_B, token: 'B'.repeat(43) };
    const issue = jest.fn().mockResolvedValue(replacement);
    await expect(
      ensureWitnessInvite(USER_A, PROMISE_ID, PARTICIPANT_ID, repository, issue),
    ).resolves.toEqual(replacement);
    expect(issue).toHaveBeenCalledWith(PROMISE_ID, PARTICIPANT_ID);
    await expect(repository.load(USER_A, PROMISE_ID, PARTICIPANT_ID)).resolves.toEqual(replacement);
  });

  test('new slot response without token reissues its returned participant slot', async () => {
    const s = storeSpy();
    const repository = new WitnessInviteRepository(s.store);
    const replay = { ...invite } as WitnessInviteResponse;
    delete replay.token;
    const replacement = { ...invite, token: 'C'.repeat(43) };
    const issue = jest.fn()
      .mockResolvedValueOnce(replay)
      .mockResolvedValueOnce(replacement);
    const result = await ensureWitnessInvite(USER_A, PROMISE_ID, null, repository, issue);
    expect(result).toEqual(replacement);
    expect(issue).toHaveBeenNthCalledWith(1, PROMISE_ID, null);
    expect(issue).toHaveBeenNthCalledWith(2, PROMISE_ID, PARTICIPANT_ID);
  });

  test('share contains title and link only', async () => {
    await shareWitnessInvite(invite);
    expect(Share.share).toHaveBeenCalledWith({
      message: `매일 걷기\nhttps://littlefinger-app.web.app/i/${invite.token}`,
    });
  });
});
