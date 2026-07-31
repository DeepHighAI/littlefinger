// @vitest-environment jsdom
import {
  ENDPOINT,
  ERROR_MESSAGE,
  IDEMPOTENCY_KEY_HEADER,
  type ParticipantPromiseSummary,
} from '@littlefinger/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  discardFulfillmentEvidence,
  FulfillmentApiError,
  getPromiseFulfillmentDetail,
  listParticipantPromises,
  reopenFulfillment,
  signFulfillmentEvidence,
  submitFulfillment,
  uploadFulfillmentEvidence,
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

  it('호출자가 보존한 키를 제출·재확인 재시도에 그대로 전달한다', async () => {
    const submitKey = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const reopenKey = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    fetchMock
      .mockResolvedValueOnce(response(200, { promise_id: PROMISE_ID, status: 'CHECKING' }))
      .mockResolvedValueOnce(response(200, { promise_id: PROMISE_ID, status: 'CHECKING' }));

    await submitFulfillment(
      ACCESS_TOKEN,
      { promise_id: PROMISE_ID, answer: 'KEPT', comment: '완료했어요' },
      submitKey,
    );
    const submitHeaders = lastRequest()[1].headers as Record<string, string>;
    await reopenFulfillment(ACCESS_TOKEN, { promise_id: PROMISE_ID }, reopenKey);
    const reopenHeaders = lastRequest()[1].headers as Record<string, string>;

    expect(submitHeaders[IDEMPOTENCY_KEY_HEADER]).toBe(submitKey);
    expect(reopenHeaders[IDEMPOTENCY_KEY_HEADER]).toBe(reopenKey);
  });

  it('증빙 파일은 브라우저가 multipart boundary를 만들고 사진별 멱등 키를 보낸다', async () => {
    fetchMock.mockResolvedValue(
      response(200, {
        upload_id: 'upload-1',
        status: 'READY',
        mime: 'image/jpeg',
        bytes: 100,
        width: 10,
        height: 10,
      }),
    );
    const file = new File(['jpeg'], 'proof.jpg', { type: 'image/jpeg' });

    await uploadFulfillmentEvidence(
      ACCESS_TOKEN,
      PROMISE_ID,
      1,
      file,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    );

    const [url, init] = lastRequest();
    const headers = init.headers as Record<string, string>;
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.evidenceUpload}`);
    expect(headers).toEqual({
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      [IDEMPOTENCY_KEY_HEADER]: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    expect(headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('promise_id')).toBe(PROMISE_ID);
    expect(form.get('round_no')).toBe('1');
    expect(form.get('file')).toBe(file);
  });

  it('증빙 폐기는 멱등 JSON이고 서명 URL은 조회 요청이다', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(200, { upload_id: 'upload-1', status: 'DISCARDED' }),
      )
      .mockResolvedValueOnce(
        response(200, {
          evidence_id: 'evidence-1',
          variant: 'THUMBNAIL',
          signed_url: 'https://storage.example/evidence-1',
          expires_at: '2026-07-31T01:10:00.000Z',
        }),
      );

    await discardFulfillmentEvidence(
      ACCESS_TOKEN,
      'upload-1',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    );
    const discard = lastRequest();
    await signFulfillmentEvidence(ACCESS_TOKEN, 'evidence-1', 'THUMBNAIL');
    const sign = lastRequest();

    expect(discard[0]).toBe(
      `${SUPABASE_URL}/functions/v1/${ENDPOINT.evidenceDiscard}`,
    );
    expect(JSON.parse(String(discard[1].body))).toEqual({
      upload_id: 'upload-1',
    });
    expect(
      (discard[1].headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER],
    ).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    expect(sign[0]).toBe(
      `${SUPABASE_URL}/functions/v1/${ENDPOINT.evidenceSignUrl}`,
    );
    expect(JSON.parse(String(sign[1].body))).toEqual({
      evidence_id: 'evidence-1',
      variant: 'THUMBNAIL',
    });
    expect(
      (sign[1].headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER],
    ).toBeUndefined();
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
