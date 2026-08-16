import { describe, expect, test } from 'vitest';

import * as shared from './index.ts';

const CURRENT = {
  version_no: 1,
  title: '매일 걷기',
  body: '매일 저녁 30분을 함께 걷는다',
  category: 'HABIT',
  end_date: '2026-08-20',
  keeper: 'BOTH',
  reward: null,
  penalty: '설거지',
  content_hash: 'a'.repeat(64),
  fingerprint: 'AAAA-BBBB-CC',
  activated_at: '2026-08-01T00:00:00Z',
  superseded_at: null,
  change_reason: null,
} as const;

const ACTOR = {
  user_id: '11111111-1111-4111-8111-111111111111',
  nickname: '민준',
  profile_image_url: null,
} as const;

type SharedRuntime = Record<string, unknown>;

function runtime(): SharedRuntime {
  return shared as unknown as SharedRuntime;
}

describe('F-11 shared amend agreement boundary', () => {
  test('changedPromiseFields reports only changed fields in the fixed display order', () => {
    const changedPromiseFields = runtime()['changedPromiseFields'] as
      | ((before: unknown, after: unknown) => string[])
      | undefined;

    expect(
      changedPromiseFields?.(CURRENT, {
        ...CURRENT,
        body: '주말에는 60분을 함께 걷는다',
        end_date: '2026-09-01',
        reward: '커피 한 잔',
      }),
    ).toEqual(['body', 'end_date', 'reward']);
  });

  test('strict create response parser accepts the public shape and rejects extra fields', () => {
    const parse = runtime()['asPromiseAmendCreateResponse'] as
      | ((value: unknown) => unknown)
      | undefined;
    const value = {
      promise_id: '22222222-2222-4222-8222-222222222222',
      status: 'AMEND_PENDING',
      request_id: '33333333-3333-4333-8333-333333333333',
      type: 'AMEND',
      expires_at: '2026-08-24T00:00:00Z',
    };

    expect(parse?.(value)).toEqual(value);
    expect(parse?.({ ...value, internal_note: 'hidden' })).toBeNull();
  });

  test('strict respond and withdraw parsers preserve the authoritative terminal state', () => {
    const parseRespond = runtime()['asPromiseAmendRespondResponse'] as
      | ((value: unknown) => unknown)
      | undefined;
    const parseWithdraw = runtime()['asPromiseAmendWithdrawResponse'] as
      | ((value: unknown) => unknown)
      | undefined;

    expect(
      parseRespond?.({
        promise_id: '22222222-2222-4222-8222-222222222222',
        status: 'ACTIVE',
        request_id: '33333333-3333-4333-8333-333333333333',
        request_status: 'APPROVED',
        version_no: 2,
      }),
    ).toEqual({
      promise_id: '22222222-2222-4222-8222-222222222222',
      status: 'ACTIVE',
      request_id: '33333333-3333-4333-8333-333333333333',
      request_status: 'APPROVED',
      version_no: 2,
    });
    expect(
      parseWithdraw?.({
        promise_id: '22222222-2222-4222-8222-222222222222',
        status: 'ACTIVE',
        request_id: '33333333-3333-4333-8333-333333333333',
        request_status: 'WITHDRAWN',
      }),
    ).toEqual({
      promise_id: '22222222-2222-4222-8222-222222222222',
      status: 'ACTIVE',
      request_id: '33333333-3333-4333-8333-333333333333',
      request_status: 'WITHDRAWN',
    });
    expect(
      parseRespond?.({
        promise_id: '22222222-2222-4222-8222-222222222222',
        status: 'ACTIVE',
        request_id: '33333333-3333-4333-8333-333333333333',
        request_status: 'APPROVED',
        version_no: null,
      }),
    ).toBeNull();
  });

  test('version history parser keeps activated versions newest-first and rejects inactive rows', () => {
    const parse = runtime()['asPromiseVersionListResponse'] as
      | ((value: unknown) => unknown)
      | undefined;
    const response = {
      promise_id: '22222222-2222-4222-8222-222222222222',
      versions: [
        {
          version: { ...CURRENT, version_no: 2 },
          change_requester: ACTOR,
          approved_by: { ...ACTOR, user_id: '44444444-4444-4444-8444-444444444444' },
          approved_at: '2026-08-17T00:00:00Z',
          change_reason: '기간을 늘려요',
        },
        {
          version: CURRENT,
          change_requester: null,
          approved_by: ACTOR,
          approved_at: '2026-08-01T00:00:00Z',
          change_reason: null,
        },
      ],
    };

    expect(parse?.(response)).toEqual(response);
    expect(
      parse?.({
        ...response,
        versions: [
          {
            ...response.versions[0],
            version: { ...CURRENT, version_no: null, activated_at: null },
          },
        ],
      }),
    ).toBeNull();
    expect(
      parse?.({
        ...response,
        versions: [
          {
            ...response.versions[0],
            change_requester: {
              ...ACTOR,
              profile_image_url: 'http://insecure.example/profile.png',
            },
          },
        ],
      }),
    ).toBeNull();
  });
});
