// @vitest-environment jsdom
import {
  ENDPOINT,
  ERROR_MESSAGE,
  IDEMPOTENCY_KEY_HEADER,
  type PromiseAmendCreateRequest,
} from '@littlefinger/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ACCESS_TOKEN = 'stored-session-jwt';
const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const KEY = '33333333-3333-4333-8333-333333333333';
const SUPABASE_URL = 'https://test-project.supabase.co';
const fetchMock = vi.fn();

interface PromiseAmendApiErrorConstructor {
  new (...args: never[]): Error & { authExpired: boolean };
}

interface ApiModule {
  PromiseAmendApiError: PromiseAmendApiErrorConstructor;
  requestPromiseAmend(accessToken: string, body: PromiseAmendCreateRequest, key: string): Promise<unknown>;
  respondPromiseAmend(
    accessToken: string,
    body: { promise_id: string; request_id: string; decision: 'APPROVE' | 'DECLINE' },
    key: string,
  ): Promise<unknown>;
  withdrawPromiseAmend(
    accessToken: string,
    promiseId: string,
    requestId: string,
    key: string,
  ): Promise<unknown>;
  listPromiseVersions(accessToken: string, promiseId: string): Promise<unknown>;
}

let api: ApiModule | null = null;

beforeEach(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  const modulePath = './promise-amend-api.ts';
  api = await import(/* @vite-ignore */ modulePath).catch(() => null) as ApiModule | null;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function requiredApi(): ApiModule {
  expect(api).not.toBeNull();
  if (api === null) throw new Error('MISSING_MODULE');
  return api;
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function lastRequest(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
}

describe('web F-11 amend API', () => {
  it('creates an intent with bearer auth and the retained idempotency key', async () => {
    const body: PromiseAmendCreateRequest = {
      promise_id: PROMISE_ID,
      type: 'CANCEL',
      reason: '파기 요청',
    };
    fetchMock.mockResolvedValue(response(200, {
      promise_id: PROMISE_ID,
      status: 'AMEND_PENDING',
      request_id: REQUEST_ID,
      type: 'CANCEL',
      expires_at: '2026-08-24T00:00:00Z',
    }));

    await requiredApi().requestPromiseAmend(ACCESS_TOKEN, body, KEY);
    const [url, init] = lastRequest();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.promiseAmendRequest}`);
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      [IDEMPOTENCY_KEY_HEADER]: KEY,
    });
  });

  it('responds and withdraws with the same logical-intent key supplied by the caller', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, {
        promise_id: PROMISE_ID,
        status: 'ACTIVE',
        request_id: REQUEST_ID,
        request_status: 'DECLINED',
        version_no: null,
      }))
      .mockResolvedValueOnce(response(200, {
        promise_id: PROMISE_ID,
        status: 'ACTIVE',
        request_id: REQUEST_ID,
        request_status: 'WITHDRAWN',
      }));

    await requiredApi().respondPromiseAmend(ACCESS_TOKEN, {
      promise_id: PROMISE_ID,
      request_id: REQUEST_ID,
      decision: 'DECLINE',
    }, KEY);
    await requiredApi().withdrawPromiseAmend(ACCESS_TOKEN, PROMISE_ID, REQUEST_ID, KEY);

    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({
      [IDEMPOTENCY_KEY_HEADER]: KEY,
    });
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({
      [IDEMPOTENCY_KEY_HEADER]: KEY,
    });
  });

  it('lists strict version history without an idempotency header', async () => {
    fetchMock.mockResolvedValue(response(200, { promise_id: PROMISE_ID, versions: [] }));
    await expect(requiredApi().listPromiseVersions(ACCESS_TOKEN, PROMISE_ID)).resolves.toEqual({
      promise_id: PROMISE_ID,
      versions: [],
    });
    const [url, init] = lastRequest();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.promiseVersionList}`);
    expect((init.headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER]).toBeUndefined();
  });

  it('rejects malformed successes and flattens unknown failures', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, {
        promise_id: PROMISE_ID,
        status: 'AMEND_PENDING',
        request_id: REQUEST_ID,
        type: 'CANCEL',
        expires_at: '2026-08-24T00:00:00Z',
        requester_id: REQUEST_ID,
      }))
      .mockResolvedValueOnce(response(500, { message: 'relation amend_requests leaked' }));
    const body: PromiseAmendCreateRequest = { promise_id: PROMISE_ID, type: 'CANCEL' };

    const malformed = await requiredApi().requestPromiseAmend(ACCESS_TOKEN, body, KEY)
      .catch((error: unknown) => error);
    const unknown = await requiredApi().requestPromiseAmend(ACCESS_TOKEN, body, KEY)
      .catch((error: unknown) => error);
    expect(malformed).toBeInstanceOf(requiredApi().PromiseAmendApiError);
    expect((malformed as Error).message).not.toContain('requester_id');
    expect((unknown as Error).message).not.toContain('relation');
  });

  it('identifies an expired bearer session', async () => {
    fetchMock.mockResolvedValue(response(401, { message: 'Invalid JWT' }));
    const raised = await requiredApi().listPromiseVersions(ACCESS_TOKEN, PROMISE_ID)
      .catch((error: unknown) => error);
    expect(raised).toBeInstanceOf(requiredApi().PromiseAmendApiError);
    expect((raised as Error & { authExpired: boolean }).authExpired).toBe(true);
    expect((raised as Error).message).toBe(ERROR_MESSAGE.E_AUTH_REQUIRED);
  });
});
