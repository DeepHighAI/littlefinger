import {
  type Endpoint,
  type FulfillmentCheckView,
  type FulfillmentSubmitRequest,
  type ParticipantPromiseSummary,
  type PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';

import {
  callMobileFunction,
  type MobileApiDeps,
  type MobileApiOptions,
} from './mobile-api.ts';
import {
  listParticipantPromises,
  loadFulfillmentDetail,
  reopenFulfillment,
  submitFulfillment,
} from './fulfillment-api.ts';

const mobileDeps: MobileApiDeps = {
  fetch: jest.fn(),
  functionUrl: (endpoint) =>
    `https://project.supabase.co/functions/v1/${endpoint}`,
  getAccessToken: jest.fn(),
  randomUuid: jest.fn(() => '38ae6b47-6ce8-4c9e-adbf-c4dfed61ac7e'),
};

async function call<T>(
  endpoint: Endpoint,
  body: unknown,
  options: MobileApiOptions,
): Promise<T> {
  return await callMobileFunction(endpoint, body, options, mobileDeps);
}

const summary: ParticipantPromiseSummary = {
  promise_id: 'promise-1',
  title: '주 3회 달리기',
  status: 'CHECKING',
  end_date: '2026-08-11',
  keeper: 'BOTH',
  updated_at: '2026-08-12T00:00:00Z',
  check_deadline_at: '2026-08-18T15:00:00Z',
  check_round_no: 1,
  needs_response: true,
  waiting_for_partner: false,
};

const ownCheck: FulfillmentCheckView = {
  role: 'CREATOR',
  answer: 'KEPT',
  comment: '함께 달렸어요',
  submitted_at: '2026-08-12T01:00:00Z',
  revised_at: null,
  round_no: 1,
  evidences: [],
};

const detail: PromiseFulfillmentDetailResponse = {
  promise_id: 'promise-1',
  title: '주 3회 달리기',
  body: '매주 세 번 함께 달린다.',
  category: 'HABIT',
  end_date: '2026-08-11',
  keeper: 'BOTH',
  reward: null,
  penalty: null,
  status: 'CHECKING',
  checking_started_at: '2026-08-11T15:00:00Z',
  check_deadline_at: '2026-08-18T15:00:00Z',
  check_round_no: 1,
  creator: {
    user_id: 'creator-1',
    nickname: '서윤',
    profile_image_url: null,
  },
  partner: {
    user_id: 'partner-1',
    nickname: '민준',
    profile_image_url: null,
  },
  my_role: 'CREATOR',
  my_check: ownCheck,
  creator_has_submitted: true,
  partner_has_submitted: false,
  partner_check: null,
  history: [],
};

describe('모바일 이행 확인 API', () => {
  beforeEach(() => {
    jest.mocked(mobileDeps.fetch).mockReset();
    jest.mocked(mobileDeps.getAccessToken).mockReset();
    jest.mocked(mobileDeps.getAccessToken).mockResolvedValue('access-token');
    jest.mocked(mobileDeps.randomUuid).mockClear();
  });

  test('목록과 상세 조회는 멱등 키 없이 정확한 Edge endpoint를 호출한다', async () => {
    jest
      .mocked(mobileDeps.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([summary]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(detail), { status: 200 }),
      );

    await expect(listParticipantPromises({ call })).resolves.toEqual([summary]);
    await expect(loadFulfillmentDetail('promise-1', { call })).resolves.toEqual(detail);

    expect(mobileDeps.fetch).toHaveBeenNthCalledWith(
      1,
      'https://project.supabase.co/functions/v1/participant-promise-list',
      expect.objectContaining({
        body: '{}',
        headers: {
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(mobileDeps.fetch).toHaveBeenNthCalledWith(
      2,
      'https://project.supabase.co/functions/v1/promise-fulfillment-detail',
      expect.objectContaining({
        body: JSON.stringify({ promise_id: 'promise-1' }),
        headers: {
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  test('제출과 재확인은 상태 변경 endpoint를 멱등 호출한다', async () => {
    const input: FulfillmentSubmitRequest = {
      promise_id: 'promise-1',
      answer: 'NOT_KEPT',
      comment: '비가 많이 왔어요',
      revise: true,
    };
    jest
      .mocked(mobileDeps.fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promise_id: 'promise-1',
            status: 'CHECKING',
            round_no: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promise_id: 'promise-1',
            status: 'CHECKING',
            round_no: 2,
          }),
          { status: 200 },
        ),
      );

    await submitFulfillment(
      input,
      '11111111-1111-4111-8111-111111111111',
      { call },
    );
    await reopenFulfillment(
      'promise-1',
      '22222222-2222-4222-8222-222222222222',
      { call },
    );

    expect(mobileDeps.fetch).toHaveBeenNthCalledWith(
      1,
      'https://project.supabase.co/functions/v1/fulfillment-submit',
      expect.objectContaining({
        body: JSON.stringify(input),
        headers: expect.objectContaining({
          'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
        }),
      }),
    );
    expect(mobileDeps.fetch).toHaveBeenNthCalledWith(
      2,
      'https://project.supabase.co/functions/v1/fulfillment-reopen',
      expect.objectContaining({
        body: JSON.stringify({ promise_id: 'promise-1' }),
        headers: expect.objectContaining({
          'Idempotency-Key': '22222222-2222-4222-8222-222222222222',
        }),
      }),
    );
    expect(mobileDeps.randomUuid).not.toHaveBeenCalled();
  });

  test('응답이 유실돼도 제출·재확인 재시도는 호출자가 보존한 키를 그대로 쓴다', async () => {
    const input: FulfillmentSubmitRequest = {
      promise_id: 'promise-1',
      answer: 'KEPT',
    };
    jest
      .mocked(mobileDeps.fetch)
      .mockRejectedValueOnce(new Error('response lost after commit'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promise_id: 'promise-1',
            status: 'CHECKING',
            round_no: 1,
          }),
          { status: 200 },
        ),
      )
      .mockRejectedValueOnce(new Error('response lost after commit'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promise_id: 'promise-1',
            status: 'CHECKING',
            round_no: 2,
          }),
          { status: 200 },
        ),
      );

    await expect(
      submitFulfillment(
        input,
        '33333333-3333-4333-8333-333333333333',
        { call },
      ),
    ).rejects.toMatchObject({ code: null });
    await submitFulfillment(
      input,
      '33333333-3333-4333-8333-333333333333',
      { call },
    );
    await expect(
      reopenFulfillment(
        'promise-1',
        '44444444-4444-4444-8444-444444444444',
        { call },
      ),
    ).rejects.toMatchObject({ code: null });
    await reopenFulfillment(
      'promise-1',
      '44444444-4444-4444-8444-444444444444',
      { call },
    );

    const headers = jest
      .mocked(mobileDeps.fetch)
      .mock.calls.map(([, init]) => init.headers as Record<string, string>);
    expect(headers.map((value) => value['Idempotency-Key'])).toEqual([
      '33333333-3333-4333-8333-333333333333',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '44444444-4444-4444-8444-444444444444',
    ]);
    expect(mobileDeps.randomUuid).not.toHaveBeenCalled();
  });

  test('화면이 코드별 문구를 결정할 수 있도록 ApiErrorBody 정보를 그대로 보존한다', async () => {
    jest.mocked(mobileDeps.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'E_STATE_CONFLICT',
          message: '현재 상태에서는 처리할 수 없어요.',
          field: 'answer',
        }),
        { status: 409 },
      ),
    );

    await expect(
      submitFulfillment(
        { promise_id: 'promise-1', answer: 'KEPT' },
        '55555555-5555-4555-8555-555555555555',
        { call },
      ),
    ).rejects.toMatchObject({
      code: 'E_STATE_CONFLICT',
      message: '현재 상태에서는 처리할 수 없어요.',
      field: 'answer',
    });
  });
});
