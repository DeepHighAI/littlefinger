// @vitest-environment jsdom
import {
  ENDPOINT,
  ERROR_MESSAGE,
  IDEMPOTENCY_KEY_HEADER,
} from '@littlefinger/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getWitnessDetail,
  joinWitness,
  leaveWitness,
  signWitness,
  WitnessApiError,
} from './witness-api.ts';

const ACCESS_TOKEN = 'stored-session-jwt';
const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const SUPABASE_URL = 'https://test-project.supabase.co';
const fetchMock = vi.fn();

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function lastRequest(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('F-05 witness web API', () => {
  it('joins with bearer session, token body, and caller idempotency key', async () => {
    fetchMock.mockResolvedValue(response(200, {
      promise_id: PROMISE_ID,
      participant_id: PARTICIPANT_ID,
      status: 'JOINED',
    }));

    await expect(joinWitness(ACCESS_TOKEN, 'raw-token', 'join-key')).resolves.toEqual({
      promise_id: PROMISE_ID,
      participant_id: PARTICIPANT_ID,
      status: 'JOINED',
    });

    const [url, init] = lastRequest();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.witnessJoin}`);
    expect(JSON.parse(String(init.body))).toEqual({ token: 'raw-token' });
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      [IDEMPOTENCY_KEY_HEADER]: 'join-key',
    });
  });

  it('reads account detail without an idempotency key', async () => {
    fetchMock.mockResolvedValue(response(200, {
      promise_id: PROMISE_ID,
      status: 'PENDING',
      visibility: 'LIMITED',
      title: '아침 러닝',
      creator: { user_id: PARTICIPANT_ID, nickname: '지우', profile_image_url: null },
      partner: null,
      activated_at: null,
      signed_at: null,
      content: null,
      fulfillment: null,
    }));

    await getWitnessDetail(ACCESS_TOKEN, PROMISE_ID);

    const [url, init] = lastRequest();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.witnessDetail}`);
    expect(JSON.parse(String(init.body))).toEqual({ promise_id: PROMISE_ID });
    expect((init.headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER]).toBeUndefined();
  });

  it('signs once with the retained idempotency key', async () => {
    fetchMock.mockResolvedValue(response(200, {
      promise_id: PROMISE_ID,
      signed_at: '2026-08-16T09:03:00Z',
    }));

    await signWitness(ACCESS_TOKEN, PROMISE_ID, 'sign-key');

    const [, init] = lastRequest();
    expect(JSON.parse(String(init.body))).toEqual({ promise_id: PROMISE_ID });
    expect((init.headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER]).toBe('sign-key');
  });

  it('leaves with the promise body and caller idempotency key', async () => {
    fetchMock.mockResolvedValue(response(200, {
      promise_id: PROMISE_ID,
      status: 'WITHDRAWN',
    }));

    await expect(leaveWitness(ACCESS_TOKEN, PROMISE_ID, 'leave-key')).resolves.toEqual({
      promise_id: PROMISE_ID,
      status: 'WITHDRAWN',
    });

    const [url, init] = lastRequest();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.witnessLeave}`);
    expect(JSON.parse(String(init.body))).toEqual({ promise_id: PROMISE_ID });
    expect((init.headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER]).toBe('leave-key');
  });

  it('rejects malformed success payloads instead of trusting the server shape', async () => {
    fetchMock.mockResolvedValue(response(200, {
      promise_id: PROMISE_ID,
      participant_id: PARTICIPANT_ID,
      status: 'PARTNER',
    }));

    const raised = await joinWitness(ACCESS_TOKEN, 'raw-token', 'join-key').catch(
      (error: unknown) => error,
    );

    expect(raised).toBeInstanceOf(WitnessApiError);
    expect((raised as Error).message).toBe('처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
  });

  it('flattens unknown errors and identifies an expired session', async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { message: 'Invalid JWT' }))
      .mockResolvedValueOnce(response(500, { message: 'relation participants leaked' }));

    const expired = await getWitnessDetail(ACCESS_TOKEN, PROMISE_ID).catch((error: unknown) => error);
    const unknown = await getWitnessDetail(ACCESS_TOKEN, PROMISE_ID).catch((error: unknown) => error);

    expect(expired).toBeInstanceOf(WitnessApiError);
    expect((expired as WitnessApiError).authExpired).toBe(true);
    expect((expired as Error).message).toBe(ERROR_MESSAGE.E_AUTH_REQUIRED);
    expect((unknown as Error).message).not.toContain('relation');
  });
});
