import {
  ENDPOINT,
  type Endpoint,
} from '@littlefinger/shared';

import {
  acknowledgeCompletionCelebrationShownWith,
  claimCompletionCelebrationWith,
  type CompletionCelebrationApiDeps,
} from './completion-celebration-api.ts';

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const CLAIM_ID = '22222222-2222-4222-8222-222222222222';
const CLAIM_KEY = '33333333-3333-4333-8333-333333333333';
const SHOWN_KEY = '44444444-4444-4444-8444-444444444444';

const view = {
  claim_id: CLAIM_ID,
  promise_id: PROMISE_ID,
  title: '매일 걷기',
  counterpart_nickname: '민준',
  keep_rate_before: 87,
  keep_rate_after: 89,
} as const;
const available = { available: true, celebration: view } as const;
const shown = { promise_id: PROMISE_ID, shown_at: '2026-08-17T09:00:00.000Z' } as const;

function deps() {
  const call = jest.fn<Promise<unknown>, [Endpoint, unknown, unknown]>();
  return { call, deps: { call } as CompletionCelebrationApiDeps };
}

describe('MOD-03 mobile Edge API', () => {
  test('claim sends only the promise and exact retained idempotency key', async () => {
    const d = deps();
    d.call.mockResolvedValue(available);

    await expect(
      claimCompletionCelebrationWith(PROMISE_ID, CLAIM_KEY, d.deps),
    ).resolves.toEqual(available);
    expect(d.call).toHaveBeenCalledWith(
      ENDPOINT.completionCelebrationClaim,
      { promise_id: PROMISE_ID },
      { idempotent: true, idempotencyKey: CLAIM_KEY },
    );
  });

  test('shown sends both identifiers and its separate retained key', async () => {
    const d = deps();
    d.call.mockResolvedValue(shown);

    await expect(
      acknowledgeCompletionCelebrationShownWith(
        PROMISE_ID,
        CLAIM_ID,
        SHOWN_KEY,
        d.deps,
      ),
    ).resolves.toEqual(shown);
    expect(d.call).toHaveBeenCalledWith(
      ENDPOINT.completionCelebrationShown,
      { promise_id: PROMISE_ID, claim_id: CLAIM_ID },
      { idempotent: true, idempotencyKey: SHOWN_KEY },
    );
  });

  test.each([
    [{ ...available, extra: true }, 'INVALID_COMPLETION_CELEBRATION_CLAIM_RESPONSE'],
    [
      { available: true, celebration: { ...view, keep_rate_after: 101 } },
      'INVALID_COMPLETION_CELEBRATION_CLAIM_RESPONSE',
    ],
    [
      { available: false, celebration: view },
      'INVALID_COMPLETION_CELEBRATION_CLAIM_RESPONSE',
    ],
  ] as const)('claim rejects malformed success %#', async (payload, error) => {
    const d = deps();
    d.call.mockResolvedValue(payload);
    await expect(
      claimCompletionCelebrationWith(PROMISE_ID, CLAIM_KEY, d.deps),
    ).rejects.toThrow(error);
  });

  test.each([
    [{ ...shown, extra: true }],
    [{ ...shown, shown_at: 'bad' }],
    [{ ...shown, promise_id: 'bad' }],
  ] as const)('shown rejects malformed success %#', async (payload) => {
    const d = deps();
    d.call.mockResolvedValue(payload);
    await expect(
      acknowledgeCompletionCelebrationShownWith(PROMISE_ID, CLAIM_ID, SHOWN_KEY, d.deps),
    ).rejects.toThrow('INVALID_COMPLETION_CELEBRATION_SHOWN_RESPONSE');
  });
});
