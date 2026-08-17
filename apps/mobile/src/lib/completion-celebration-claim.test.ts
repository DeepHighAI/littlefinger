import type { CompletionCelebrationClaimResponse } from '@littlefinger/shared';

import {
  claimCompletionCelebration,
  completionCelebrationStorageKey,
  markCompletionCelebrationShown,
  type CompletionCelebrationClaimDeps,
} from './completion-celebration-claim.ts';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const PROMISE_A = '33333333-3333-4333-8333-333333333333';
const PROMISE_B = '44444444-4444-4444-8444-444444444444';
const CLAIM_ID = '55555555-5555-4555-8555-555555555555';
const CLAIM_KEY = '66666666-6666-4666-8666-666666666666';
const SHOWN_KEY = '77777777-7777-4777-8777-777777777777';

const view = {
  claim_id: CLAIM_ID,
  promise_id: PROMISE_A,
  title: '매일 걷기',
  counterpart_nickname: '민준',
  keep_rate_before: 87,
  keep_rate_after: 89,
} as const;
const available: CompletionCelebrationClaimResponse = {
  available: true,
  celebration: view,
};

function memoryStore() {
  const values = new Map<string, string>();
  const events: string[] = [];
  return {
    values,
    events,
    storage: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        events.push(`set:${value}`);
        values.set(key, value);
      },
      removeItem: async (key: string) => {
        events.push('remove');
        values.delete(key);
      },
    },
  };
}

function createDeps(options: {
  userId?: string;
  uuids?: string[];
  claim?: (promiseId: string, key: string) => Promise<CompletionCelebrationClaimResponse>;
  shown?: (promiseId: string, claimId: string, key: string) => Promise<{
    promise_id: string;
    shown_at: string;
  }>;
  store?: ReturnType<typeof memoryStore>;
} = {}) {
  const store = options.store ?? memoryStore();
  const uuids = [...(options.uuids ?? [CLAIM_KEY, SHOWN_KEY])];
  const claimWith = jest.fn(
    options.claim ?? (async () => available),
  );
  const acknowledgeShownWith = jest.fn(
    options.shown ?? (async () => ({
      promise_id: PROMISE_A,
      shown_at: '2026-08-17T09:00:00.000Z',
    })),
  );
  const deps: CompletionCelebrationClaimDeps = {
    currentUserId: async () => options.userId ?? USER_A,
    randomUuid: () => {
      const next = uuids.shift();
      if (next === undefined) throw new Error('missing deterministic UUID');
      return next;
    },
    storage: store.storage,
    claimWith,
    acknowledgeShownWith,
  };
  return { deps, store, claimWith, acknowledgeShownWith };
}

describe('MOD-03 encrypted claim and shown lifecycle', () => {
  test('stores PENDING before the claim network call', async () => {
    const d = createDeps({
      claim: async () => {
        d.store.events.push('claim');
        return available;
      },
    });

    await claimCompletionCelebration(PROMISE_A, d.deps);

    expect(d.store.events[0]).toContain('"phase":"PENDING"');
    expect(d.store.events[0]).toContain(CLAIM_KEY);
    expect(d.store.events[1]).toBe('claim');
  });

  test('reuses one key after rejection and across a new repository instance', async () => {
    const store = memoryStore();
    const first = createDeps({
      store,
      claim: async () => { throw new Error('network'); },
      uuids: [CLAIM_KEY],
    });
    await expect(claimCompletionCelebration(PROMISE_A, first.deps)).rejects.toThrow('network');

    const second = createDeps({ store, uuids: [] });
    await claimCompletionCelebration(PROMISE_A, second.deps);
    expect(first.claimWith).toHaveBeenCalledWith(PROMISE_A, CLAIM_KEY);
    expect(second.claimWith).toHaveBeenCalledWith(PROMISE_A, CLAIM_KEY);
  });

  test('available false removes the envelope and returns null', async () => {
    const d = createDeps({
      claim: async () => ({ available: false, celebration: null }),
      uuids: [CLAIM_KEY],
    });
    await expect(claimCompletionCelebration(PROMISE_A, d.deps)).resolves.toBeNull();
    expect(d.store.values.size).toBe(0);
    expect(d.store.events.at(-1)).toBe('remove');
  });

  test('available true returns only the view and retains PENDING until onShow', async () => {
    const d = createDeps({ uuids: [CLAIM_KEY] });
    await expect(claimCompletionCelebration(PROMISE_A, d.deps)).resolves.toEqual(view);
    const stored = [...d.store.values.values()][0];
    expect(stored).toBe(JSON.stringify({ phase: 'PENDING', claim_idempotency_key: CLAIM_KEY }));
  });

  test('mark shown stores the server claim ID and a separate key before acknowledgement', async () => {
    const d = createDeps({ uuids: [SHOWN_KEY] });
    d.store.values.set(
      completionCelebrationStorageKey(USER_A, PROMISE_A),
      JSON.stringify({ phase: 'PENDING', claim_idempotency_key: CLAIM_KEY }),
    );
    d.acknowledgeShownWith.mockImplementation(async () => {
      const stored = [...d.store.values.values()][0];
      expect(stored).toBe(JSON.stringify({
        phase: 'SHOWN',
        claim_id: CLAIM_ID,
        shown_idempotency_key: SHOWN_KEY,
      }));
      return { promise_id: PROMISE_A, shown_at: '2026-08-17T09:00:00.000Z' };
    });

    await markCompletionCelebrationShown(PROMISE_A, CLAIM_ID, d.deps);
    expect(d.acknowledgeShownWith).toHaveBeenCalledWith(PROMISE_A, CLAIM_ID, SHOWN_KEY);
  });

  test('failed shown acknowledgement survives restart and retries without redisplay', async () => {
    const store = memoryStore();
    const first = createDeps({
      store,
      shown: async () => { throw new Error('ack failed'); },
      uuids: [SHOWN_KEY],
    });
    await expect(
      markCompletionCelebrationShown(PROMISE_A, CLAIM_ID, first.deps),
    ).rejects.toThrow('ack failed');

    const second = createDeps({ store, uuids: [] });
    await expect(claimCompletionCelebration(PROMISE_A, second.deps)).resolves.toBeNull();
    expect(second.claimWith).not.toHaveBeenCalled();
    expect(second.acknowledgeShownWith).toHaveBeenCalledWith(
      PROMISE_A,
      CLAIM_ID,
      SHOWN_KEY,
    );
    expect(store.values.size).toBe(0);
  });

  test('shown success clears only after the server response', async () => {
    const d = createDeps({ uuids: [SHOWN_KEY] });
    d.store.values.set(
      completionCelebrationStorageKey(USER_A, PROMISE_A),
      JSON.stringify({ phase: 'PENDING', claim_idempotency_key: CLAIM_KEY }),
    );
    d.acknowledgeShownWith.mockImplementation(async () => {
      expect(d.store.values.size).toBe(1);
      return { promise_id: PROMISE_A, shown_at: '2026-08-17T09:00:00.000Z' };
    });
    await markCompletionCelebrationShown(PROMISE_A, CLAIM_ID, d.deps);
    expect(d.store.values.size).toBe(0);
  });

  test('uses the server claim ID without synthesizing or replacing it', async () => {
    const serverClaimId = '88888888-8888-4888-8888-888888888888';
    const response = {
      available: true,
      celebration: { ...view, claim_id: serverClaimId },
    } as const;
    const d = createDeps({ claim: async () => response, uuids: [CLAIM_KEY] });

    const result = await claimCompletionCelebration(PROMISE_A, d.deps);
    expect(result?.claim_id).toBe(serverClaimId);
    expect(result?.claim_id).not.toBe(CLAIM_KEY);
  });

  test('scopes envelopes by user and promise', () => {
    expect(completionCelebrationStorageKey(USER_A, PROMISE_A)).not.toBe(
      completionCelebrationStorageKey(USER_B, PROMISE_A),
    );
    expect(completionCelebrationStorageKey(USER_A, PROMISE_A)).not.toBe(
      completionCelebrationStorageKey(USER_A, PROMISE_B),
    );
  });

  test('never persists title nickname rates or share text', async () => {
    const d = createDeps({ uuids: [CLAIM_KEY] });
    await claimCompletionCelebration(PROMISE_A, d.deps);
    const serialized = JSON.stringify([...d.store.values.values()]);
    for (const privateValue of [view.title, view.counterpart_nickname, '87', '89', '공유']) {
      expect(serialized).not.toContain(String(privateValue));
    }
  });
});
