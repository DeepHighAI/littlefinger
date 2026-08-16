import type { WitnessInviteResponse } from '@littlefinger/shared';

import {
  issueWitnessInviteWith,
  listWitnessesWith,
  type WitnessApiDeps,
} from './witness-api.ts';

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const INVITATION_ID = '33333333-3333-4333-8333-333333333333';

function spy(payload: unknown) {
  const calls: { endpoint: string; body: unknown; options: unknown }[] = [];
  const deps: WitnessApiDeps = {
    call: async <T>(endpoint: string, body: unknown, options: unknown) => {
      calls.push({ endpoint, body, options });
      return payload as T;
    },
  };
  return { deps, calls };
}

const invite: WitnessInviteResponse = {
  promise_id: PROMISE_ID,
  participant_id: PARTICIPANT_ID,
  invitation_id: INVITATION_ID,
  title: '매일 걷기',
  expires_at: '2026-08-20T00:00:00Z',
  token: 'A'.repeat(43),
};

describe('mobile witness API', () => {
  test('list is read-only and strictly parses witness slots', async () => {
    const s = spy({ promise_id: PROMISE_ID, occupied_count: 0, capacity: 2, witnesses: [] });
    await expect(listWitnessesWith(PROMISE_ID, s.deps)).resolves.toMatchObject({ capacity: 2 });
    expect(s.calls).toEqual([{
      endpoint: 'witness-invite-list',
      body: { promise_id: PROMISE_ID },
      options: { idempotent: false },
    }]);
  });

  test('issue uses a fresh idempotency key through the mobile boundary', async () => {
    const s = spy(invite);
    await expect(issueWitnessInviteWith(PROMISE_ID, PARTICIPANT_ID, s.deps)).resolves.toEqual(invite);
    expect(s.calls).toEqual([{
      endpoint: 'witness-invite',
      body: { promise_id: PROMISE_ID, participant_id: PARTICIPANT_ID },
      options: { idempotent: true },
    }]);
  });

  test('new slot omits participant_id instead of sending null', async () => {
    const s = spy(invite);
    await issueWitnessInviteWith(PROMISE_ID, null, s.deps);
    expect(s.calls[0]?.body).toEqual({ promise_id: PROMISE_ID });
  });

  test.each([
    ['list', { promise_id: PROMISE_ID, occupied_count: 0, capacity: 2, witnesses: [], extra: true }],
    ['issue', { ...invite, token_hash: 'a'.repeat(64) }],
  ] as const)('%s rejects a response outside the strict shared contract', async (kind, payload) => {
    const s = spy(payload);
    const operation = kind === 'list'
      ? listWitnessesWith(PROMISE_ID, s.deps)
      : issueWitnessInviteWith(PROMISE_ID, null, s.deps);
    await expect(operation).rejects.toThrow(`INVALID_WITNESS_${kind.toUpperCase()}_RESPONSE`);
  });
});
