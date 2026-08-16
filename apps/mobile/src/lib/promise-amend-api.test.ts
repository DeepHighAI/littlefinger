import type {
  PromiseAmendCreateRequest,
  PromiseAmendCreateResponse,
  PromiseAmendRespondRequest,
  PromiseAmendRespondResponse,
  PromiseAmendWithdrawResponse,
  PromiseVersionListResponse,
} from '@littlefinger/shared';

import {
  listPromiseVersions,
  requestPromiseAmend,
  respondPromiseAmend,
  withdrawPromiseAmend,
} from './promise-amend-api.ts';

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const KEY = '33333333-3333-4333-8333-333333333333';

interface ApiDeps {
  call<T>(endpoint: string, body: unknown, options: unknown): Promise<T>;
}

function spy(...payloads: unknown[]) {
  const calls: { endpoint: string; body: unknown; options: unknown }[] = [];
  const deps: ApiDeps = {
    call: async <T>(endpoint: string, body: unknown, options: unknown) => {
      calls.push({ endpoint, body, options });
      return payloads.shift() as T;
    },
  };
  return { deps, calls };
}

const createResponse: PromiseAmendCreateResponse = {
  promise_id: PROMISE_ID,
  status: 'AMEND_PENDING',
  request_id: REQUEST_ID,
  type: 'CANCEL',
  expires_at: '2026-08-24T00:00:00Z',
};

describe('mobile F-11 amend API', () => {
  test('mutation calls preserve the caller-owned idempotency key', async () => {
    const respondResponse: PromiseAmendRespondResponse = {
      promise_id: PROMISE_ID,
      status: 'ACTIVE',
      request_id: REQUEST_ID,
      request_status: 'DECLINED',
      version_no: null,
    };
    const withdrawResponse: PromiseAmendWithdrawResponse = {
      promise_id: PROMISE_ID,
      status: 'ACTIVE',
      request_id: REQUEST_ID,
      request_status: 'WITHDRAWN',
    };
    const s = spy(createResponse, respondResponse, withdrawResponse);
    const request: PromiseAmendCreateRequest = {
      promise_id: PROMISE_ID,
      type: 'CANCEL',
      reason: '서로 합의한 파기',
    };

    await requestPromiseAmend(request, KEY, s.deps);
    await respondPromiseAmend({
      promise_id: PROMISE_ID,
      request_id: REQUEST_ID,
      decision: 'DECLINE',
    }, KEY, s.deps);
    await withdrawPromiseAmend(PROMISE_ID, REQUEST_ID, KEY, s.deps);

    expect(s.calls).toEqual([
      { endpoint: 'promise-amend-request', body: request, options: { idempotent: true, idempotencyKey: KEY } },
      {
        endpoint: 'promise-amend-respond',
        body: { promise_id: PROMISE_ID, request_id: REQUEST_ID, decision: 'DECLINE' },
        options: { idempotent: true, idempotencyKey: KEY },
      },
      {
        endpoint: 'promise-amend-withdraw',
        body: { promise_id: PROMISE_ID, request_id: REQUEST_ID },
        options: { idempotent: true, idempotencyKey: KEY },
      },
    ]);
  });

  test('version history is read-only and strictly parsed', async () => {
    const s = spy({ promise_id: PROMISE_ID, versions: [] });
    await expect(listPromiseVersions(PROMISE_ID, s.deps)).resolves.toEqual({
      promise_id: PROMISE_ID,
      versions: [],
    });
    expect(s.calls).toEqual([{
      endpoint: 'promise-version-list',
      body: { promise_id: PROMISE_ID },
      options: { idempotent: false },
    }]);
  });

  test('malformed success payloads never become authoritative state', async () => {
    const s = spy({ ...createResponse, requester_id: REQUEST_ID });
    await expect(requestPromiseAmend({
      promise_id: PROMISE_ID,
      type: 'CANCEL',
    }, KEY, s.deps)).rejects.toThrow('INVALID_PROMISE_AMEND_CREATE_RESPONSE');
  });
});
