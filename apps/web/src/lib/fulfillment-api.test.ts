// @vitest-environment jsdom
import {
  ENDPOINT,
  ERROR_MESSAGE,
  IDEMPOTENCY_KEY_HEADER,
  type ParticipantPromiseSummary,
} from '@littlefinger/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FulfillmentApiError,
  getPromiseFulfillmentDetail,
  listParticipantPromises,
  reopenFulfillment,
  submitFulfillment,
} from './fulfillment-api.ts';

const ACCESS_TOKEN = 'stored-session-jwt';
const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const SUPABASE_URL = 'https://test-project.supabase.co';
const fetchMock = vi.fn();

const SUMMARY: ParticipantPromiseSummary = {
  promise_id: PROMISE_ID,
  title: '매일 걷기',
  status: 'CHECKING',
  end_date: '2026-07-30',
  keeper: 'BOTH',
  updated_at: '2026-07-31T00:00:00.000Z',
  check_deadline_at: '2026-08-07T15:00:00.000Z',
  check_round_no: 1,
  needs_response: true,
  waiting_for_partner: false,
};

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

describe('이행 확인 웹 API 클라이언트', () => {
  it('목록 읽기는 Bearer 세션만 보내고 멱등 키는 보내지 않는다', async () => {
    fetchMock.mockResolvedValue(response(200, [SUMMARY]));

    await expect(listParticipantPromises(ACCESS_TOKEN)).resolves.toEqual([SUMMARY]);

    const [url, init] = lastRequest();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.participantPromiseList}`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({});
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    });
  });

  it('상세 읽기도 멱등 키 없이 promise_id만 보낸다', async () => {
    fetchMock.mockResolvedValue(response(200, { promise_id: PROMISE_ID }));

    await getPromiseFulfillmentDetail(ACCESS_TOKEN, PROMISE_ID);

    const [url, init] = lastRequest();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.promiseFulfillmentDetail}`);
    expect(JSON.parse(String(init.body))).toEqual({ promise_id: PROMISE_ID });
    expect((init.headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER]).toBeUndefined();
  });

  it('제출과 재확인은 호출마다 새 UUID 멱등 키를 보낸다', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, { promise_id: PROMISE_ID, status: 'CHECKING' }))
      .mockResolvedValueOnce(response(200, { promise_id: PROMISE_ID, status: 'CHECKING' }));

    await submitFulfillment(ACCESS_TOKEN, { promise_id: PROMISE_ID, answer: 'KEPT' });
    const submitHeaders = lastRequest()[1].headers as Record<string, string>;
    await reopenFulfillment(ACCESS_TOKEN, { promise_id: PROMISE_ID });
    const reopenHeaders = lastRequest()[1].headers as Record<string, string>;

    expect(submitHeaders[IDEMPOTENCY_KEY_HEADER]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu,
    );
    expect(reopenHeaders[IDEMPOTENCY_KEY_HEADER]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu,
    );
    expect(submitHeaders[IDEMPOTENCY_KEY_HEADER]).not.toBe(
      reopenHeaders[IDEMPOTENCY_KEY_HEADER],
    );
  });

  it('알려진 API 오류는 코드와 서버 필드 문구를 보존한다', async () => {
    fetchMock.mockResolvedValue(
      response(422, {
        code: 'E_VALIDATION',
        field: 'comment',
        message: '의견은 200자 이하로 입력해 주세요.',
      }),
    );

    const error = await submitFulfillment(ACCESS_TOKEN, {
      promise_id: PROMISE_ID,
      answer: 'KEPT',
      comment: 'x',
    }).catch((raised: unknown) => raised);

    expect(error).toBeInstanceOf(FulfillmentApiError);
    expect((error as FulfillmentApiError).failure).toEqual({
      code: 'E_VALIDATION',
      message: '의견은 200자 이하로 입력해 주세요.',
      action: null,
    });
    expect((error as Error).message).toBe('의견은 200자 이하로 입력해 주세요.');
  });

  it('코드 없는 401은 세션 만료이고 모르는 500 문구는 노출하지 않는다', async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { message: 'Invalid JWT' }))
      .mockResolvedValueOnce(response(500, { message: 'relation promises leaked' }));

    const expired = await listParticipantPromises(ACCESS_TOKEN).catch(
      (raised: unknown) => raised,
    );
    const unknown = await listParticipantPromises(ACCESS_TOKEN).catch(
      (raised: unknown) => raised,
    );

    expect(expired).toBeInstanceOf(FulfillmentApiError);
    expect((expired as FulfillmentApiError).authExpired).toBe(true);
    expect((unknown as Error).message).toBe('처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
    expect((unknown as Error).message).not.toContain('relation');
    expect((expired as Error).message).toBe(ERROR_MESSAGE.E_AUTH_REQUIRED);
  });
});
