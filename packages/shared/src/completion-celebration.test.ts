import { describe, expect, test } from 'vitest';

import { ENDPOINT } from './api.ts';
import {
  asCompletionCelebrationClaimResponse,
  asCompletionCelebrationShownResponse,
  completionKeepRateLabel,
} from './completion-celebration.ts';

const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const SHOWN_AT = '2026-08-17T08:30:00.000Z';

const view = {
  claim_id: CLAIM_ID,
  promise_id: PROMISE_ID,
  title: '매주 화·목 아침 러닝 같이 하기',
  counterpart_nickname: '민준',
  keep_rate_before: 87,
  keep_rate_after: 89,
} as const;

describe('MOD-03 completion celebration contract', () => {
  test('accepts only the exact available and unavailable claim union', () => {
    const available = { available: true, celebration: view } as const;

    expect(asCompletionCelebrationClaimResponse(available)).toEqual(available);
    expect(
      asCompletionCelebrationClaimResponse({ available: false, celebration: null }),
    ).toEqual({ available: false, celebration: null });
    expect(asCompletionCelebrationClaimResponse({ ...available, extra: true })).toBeNull();
    expect(
      asCompletionCelebrationClaimResponse({ available: true, celebration: null }),
    ).toBeNull();
    expect(
      asCompletionCelebrationClaimResponse({ available: false, celebration: view }),
    ).toBeNull();
  });

  test('rejects invalid identifiers, rates, and view fields', () => {
    const available = { available: true, celebration: view } as const;

    expect(
      asCompletionCelebrationClaimResponse({
        ...available,
        celebration: { ...view, keep_rate_after: 101 },
      }),
    ).toBeNull();
    expect(
      asCompletionCelebrationClaimResponse({
        ...available,
        celebration: { ...view, keep_rate_before: 75.5 },
      }),
    ).toBeNull();
    expect(
      asCompletionCelebrationClaimResponse({
        ...available,
        celebration: { ...view, promise_id: 'bad' },
      }),
    ).toBeNull();
    expect(
      asCompletionCelebrationClaimResponse({
        ...available,
        celebration: { ...view, claim_id: 'bad' },
      }),
    ).toBeNull();
    expect(
      asCompletionCelebrationClaimResponse({
        ...available,
        celebration: { ...view, title: '' },
      }),
    ).toBeNull();
    expect(
      asCompletionCelebrationClaimResponse({
        ...available,
        celebration: { ...view, counterpart_nickname: 123 },
      }),
    ).toBeNull();
  });

  test('accepts only an exact shown acknowledgement response', () => {
    const shown = { promise_id: PROMISE_ID, shown_at: SHOWN_AT } as const;

    expect(asCompletionCelebrationShownResponse(shown)).toEqual(shown);
    expect(asCompletionCelebrationShownResponse({ ...shown, extra: true })).toBeNull();
    expect(
      asCompletionCelebrationShownResponse({ ...shown, promise_id: 'bad' }),
    ).toBeNull();
    expect(
      asCompletionCelebrationShownResponse({ ...shown, shown_at: 'not-an-instant' }),
    ).toBeNull();
  });

  test.each([
    [87, 89, '약속 지킴율 87% → 89%'],
    [75, 75, '약속 지킴율 75% 유지'],
    [null, 100, '지킴율 집계가 시작됐어요 · 100%'],
    [null, null, '약속 지킴율 집계 중'],
    [75, null, '약속 지킴율 집계 중'],
  ] as const)('renders the approved keep-rate state %#', (before, after, expected) => {
    expect(completionKeepRateLabel(before, after)).toBe(expected);
  });

  test('publishes stable claim and shown endpoints', () => {
    expect(ENDPOINT.completionCelebrationClaim).toBe('completion-celebration-claim');
    expect(ENDPOINT.completionCelebrationShown).toBe('completion-celebration-shown');
  });
});
