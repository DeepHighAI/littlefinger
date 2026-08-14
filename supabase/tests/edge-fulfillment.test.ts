import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';
import { createFulfillmentReopenHandler } from '../functions/fulfillment-reopen/handler.ts';
import { createFulfillmentSubmitHandler } from '../functions/fulfillment-submit/handler.ts';
import { createParticipantPromiseListHandler } from '../functions/participant-promise-list/handler.ts';
import { createPromiseFulfillmentDetailHandler } from '../functions/promise-fulfillment-detail/handler.ts';

const ACTOR_ID = '11111111-1111-1111-1111-111111111111';
const PARTNER_ID = '22222222-2222-2222-2222-222222222222';
const WITNESS_ID = '33333333-3333-3333-3333-333333333333';
const PROMISE_ID = '44444444-4444-4444-4444-444444444444';
const KEY = '55555555-5555-4555-8555-555555555555';
const NOW = new Date('2026-07-31T03:00:00.000Z');

const RECIPIENTS = [
  { user_id: ACTOR_ID, role: 'CREATOR' },
  { user_id: PARTNER_ID, role: 'PARTNER' },
  { user_id: WITNESS_ID, role: 'WITNESS' },
] as const;

const SUBMIT_PAYLOAD = {
  promise_id: PROMISE_ID,
  status: 'CHECKING',
  round_no: 1,
  submitted_at: '2026-07-31T03:00:00.000Z',
  revised_at: null,
  waiting_for_partner: true,
  title: '매일 걷기',
  actor_nickname: '민준',
  notification_recipients: RECIPIENTS,
};

const REOPEN_PAYLOAD = {
  promise_id: PROMISE_ID,
  status: 'CHECKING',
  round_no: 2,
  check_deadline_at: '2026-08-07T03:00:00.000Z',
  title: '매일 걷기',
  notification_recipients: [{ user_id: PARTNER_ID, role: 'PARTNER' }],
};

interface Spy {
  deps: Deps;
  calls: string[];
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  logs: { message: string; detail: unknown }[];
}

function spy(options: {
  payload?: unknown;
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  authenticate?: (authorization: string | null) => Promise<string>;
} = {}): Spy {
  const calls: string[] = [];
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const logs: { message: string; detail: unknown }[] = [];

  const deps: Deps = {
    authenticate:
      options.authenticate ??
      (async (authorization) => {
        calls.push('authenticate');
        if (authorization === null) throw new ApiError('E_AUTH_REQUIRED');
        return ACTOR_ID;
      }),
    rpc: async (fn, args) => {
      calls.push('rpc');
      rpcCalls.push({ fn, args });
      return options.rpc === undefined ? options.payload : await options.rpc(fn, args);
    },
    secrets: { invitePepper: 'unused', piiSalt: 'unused' },
    log: { error: (message, detail) => logs.push({ message, detail }) },
    now: () => NOW,
  };

  return { deps, calls, rpcCalls, logs };
}

function request(options: {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
} = {}): Request {
  return new Request('https://ref.supabase.co/functions/v1/test', {
    method: options.method ?? 'POST',
    headers: { authorization: 'Bearer jwt', ...options.headers },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

function mutationRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Request {
  return request({ body, headers: { 'idempotency-key': KEY, ...headers } });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

const HANDLERS = [
  {
    name: 'participant-promise-list',
    create: createParticipantPromiseListHandler,
    deps: () => spy({ payload: [] }).deps,
  },
  {
    name: 'promise-fulfillment-detail',
    create: createPromiseFulfillmentDetailHandler,
    deps: () => spy({ payload: {} }).deps,
  },
  {
    name: 'fulfillment-submit',
    create: createFulfillmentSubmitHandler,
    deps: () => spy({ payload: SUBMIT_PAYLOAD }).deps,
  },
  {
    name: 'fulfillment-reopen',
    create: createFulfillmentReopenHandler,
    deps: () => spy({ payload: REOPEN_PAYLOAD }).deps,
  },
] as const;

const UNKNOWN_FAILURE_CASES = [
  {
    name: 'participant-promise-list',
    create: createParticipantPromiseListHandler,
    request: () => request(),
  },
  {
    name: 'promise-fulfillment-detail',
    create: createPromiseFulfillmentDetailHandler,
    request: () => request({ body: { promise_id: PROMISE_ID } }),
  },
  {
    name: 'fulfillment-submit',
    create: createFulfillmentSubmitHandler,
    request: () => mutationRequest({ promise_id: PROMISE_ID, answer: 'KEPT' }),
  },
  {
    name: 'fulfillment-reopen',
    create: createFulfillmentReopenHandler,
    request: () => mutationRequest({ promise_id: PROMISE_ID }),
  },
] as const;

describe('F-07 Edge 공통 경계', () => {
  test.each(HANDLERS)('$name OPTIONS는 인증 없이 CORS preflight를 반환한다', async ({ create, deps }) => {
    const response = await create(deps())(request({ method: 'OPTIONS' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  test.each(HANDLERS)('$name은 POST 외 메서드를 거절한다', async ({ create, deps }) => {
    const response = await create(deps())(request({ method: 'GET' }));
    expect(response.status).toBe(422);
  });

  test.each(HANDLERS)('$name은 약속 RPC보다 JWT를 먼저 확인한다', async ({ create }) => {
    const s = spy({
      authenticate: async () => {
        s.calls.push('authenticate');
        throw new ApiError('E_AUTH_REQUIRED');
      },
    });
    const response = await create(s.deps)(request({ body: { promise_id: 'invalid' } }));
    expect(response.status).toBe(401);
    expect(s.calls).toEqual(['authenticate']);
    expect(s.rpcCalls).toEqual([]);
  });

  test.each(UNKNOWN_FAILURE_CASES)(
    '$name의 알 수 없는 실패는 EC-C02 500으로 평탄화한다',
    async ({ create, request: makeRequest }) => {
      const s = spy({ rpc: async () => Promise.reject(new Error('private table detail')) });
      const response = await create(s.deps)(makeRequest());
      expect(response.status).toBe(500);
      expect(await response.text()).toBe(
        '{"code":"E_INTERNAL","message":"처리 중 문제가 발생했습니다. 다시 시도해 주세요."}',
      );
    },
  );
});

describe('participant-promise-list', () => {
  test('본문이 없거나 빈 객체여도 actor만 목록 RPC에 넘기고 payload를 그대로 반환한다', async () => {
    const payload = [{ promise_id: PROMISE_ID, needs_response: true }];
    for (const body of [undefined, {}]) {
      const s = spy({ payload });
      const response = await createParticipantPromiseListHandler(s.deps)(request({ body }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(payload);
      expect(s.rpcCalls).toEqual([
        { fn: 'lf_participant_promise_list', args: { p_actor: ACTOR_ID } },
      ]);
    }
  });
});

describe('promise-fulfillment-detail', () => {
  test('actor와 UUID promise_id를 상세 RPC에 정확히 넘긴다', async () => {
    const payload = { promise_id: PROMISE_ID, status: 'CHECKING' };
    const s = spy({ payload });
    const response = await createPromiseFulfillmentDetailHandler(s.deps)(
      request({ body: { promise_id: PROMISE_ID } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_promise_fulfillment_detail',
        args: { p_actor: ACTOR_ID, p_promise_id: PROMISE_ID },
      },
    ]);
  });

  test.each([{}, { promise_id: 1 }, { promise_id: 'not-a-uuid' }])(
    'promise_id 형식이 잘못되면 RPC를 호출하지 않는다: %j',
    async (body) => {
      const s = spy({ payload: {} });
      const response = await createPromiseFulfillmentDetailHandler(s.deps)(request({ body }));
      expect(response.status).toBe(422);
      expect(await jsonOf(response).then((value) => value['field'])).toBe('promise_id');
      expect(s.rpcCalls).toEqual([]);
    },
  );

  test('비참여자 E_NOT_FOUND를 존재 숨김 응답으로 보존한다', async () => {
    const s = spy({ rpc: async () => Promise.reject(new Error('E_NOT_FOUND')) });
    const response = await createPromiseFulfillmentDetailHandler(s.deps)(
      request({ body: { promise_id: PROMISE_ID } }),
    );
    expect(response.status).toBe(404);
    expect(await jsonOf(response).then((value) => value['code'])).toBe('E_NOT_FOUND');
  });
});

describe('fulfillment-submit', () => {
  let s: Spy;
  beforeEach(() => {
    s = spy({ payload: SUBMIT_PAYLOAD });
  });

  test('WEB 제출의 모든 값을 RPC 인자에 정확히 매핑한다', async () => {
    const response = await createFulfillmentSubmitHandler(s.deps)(
      mutationRequest(
        {
          promise_id: PROMISE_ID,
          answer: 'NOT_KEPT',
          comment: ' ᄀ\u0001ᅡ ',
          revise: true,
          evidence_upload_ids: [PARTNER_ID],
          retained_evidence_ids: [WITNESS_ID],
        },
        { origin: 'https://littlefinger.pages.dev' },
      ),
    );
    expect(response.status).toBe(200);
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_fulfillment_submit',
        args: {
          p_actor: ACTOR_ID,
          p_answer: 'NOT_KEPT',
          p_comment: ' ᄀ\u0001ᅡ ',
          p_idempotency_key: KEY,
          p_promise_id: PROMISE_ID,
          p_revise: true,
          p_evidence_upload_ids: [PARTNER_ID],
          p_retained_evidence_ids: [WITNESS_ID],
          p_surface: 'WEB',
        },
      },
    ]);
  });

  test('comment/revise 생략은 null/false이고 Origin이 없으면 APP이다', async () => {
    await createFulfillmentSubmitHandler(s.deps)(
      mutationRequest({ promise_id: PROMISE_ID, answer: 'KEPT' }),
    );
    expect(s.rpcCalls[0]?.args).toMatchObject({
      p_comment: null,
      p_revise: false,
      p_evidence_upload_ids: [],
      p_retained_evidence_ids: [],
      p_surface: 'APP',
    });
  });

  test.each([
    [{ answer: 'KEPT' }, 'promise_id'],
    [{ promise_id: 'bad', answer: 'KEPT' }, 'promise_id'],
    [{ promise_id: PROMISE_ID }, 'answer'],
    [{ promise_id: PROMISE_ID, answer: 'MAYBE' }, 'answer'],
    [{ promise_id: PROMISE_ID, answer: 'KEPT', comment: null }, 'comment'],
    [{ promise_id: PROMISE_ID, answer: 'KEPT', comment: 1 }, 'comment'],
    [{ promise_id: PROMISE_ID, answer: 'KEPT', revise: null }, 'revise'],
    [{ promise_id: PROMISE_ID, answer: 'KEPT', revise: 'yes' }, 'revise'],
    [{ promise_id: PROMISE_ID, answer: 'KEPT', evidence_upload_ids: null }, 'evidences'],
    [{ promise_id: PROMISE_ID, answer: 'KEPT', evidence_upload_ids: ['bad'] }, 'upload_id'],
    [{ promise_id: PROMISE_ID, answer: 'KEPT', retained_evidence_ids: [1] }, 'evidence_id'],
    [
      {
        promise_id: PROMISE_ID,
        answer: 'KEPT',
        evidence_upload_ids: [ACTOR_ID, PARTNER_ID],
        retained_evidence_ids: [WITNESS_ID, PROMISE_ID],
      },
      'evidences',
    ],
  ] as const)('잘못된 제출 형태 %j는 %s 오류다', async (body, field) => {
    const response = await createFulfillmentSubmitHandler(s.deps)(mutationRequest({ ...body }));
    expect(response.status).toBe(422);
    expect(await jsonOf(response).then((value) => value['field'])).toBe(field);
    expect(s.rpcCalls).toEqual([]);
  });

  test('Idempotency-Key가 없거나 UUID가 아니면 거절한다', async () => {
    for (const headers of [{}, { 'idempotency-key': 'bad' }]) {
      const local = spy({ payload: SUBMIT_PAYLOAD });
      const response = await createFulfillmentSubmitHandler(local.deps)(
        request({
          body: { promise_id: PROMISE_ID, answer: 'KEPT' },
          headers,
        }),
      );
      expect(response.status).toBe(422);
      expect(await jsonOf(response).then((value) => value['field'])).toBe('idempotency_key');
      expect(local.rpcCalls).toEqual([]);
    }
  });

  test('깨진 JSON 본문은 RPC 전에 promise_id 검증 오류로 거절한다', async () => {
    const response = await createFulfillmentSubmitHandler(s.deps)(
      new Request('https://ref.supabase.co/functions/v1/fulfillment-submit', {
        method: 'POST',
        headers: {
          authorization: 'Bearer jwt',
          'idempotency-key': KEY,
          'content-type': 'application/json',
        },
        body: '{',
      }),
    );
    expect(response.status).toBe(422);
    expect(await jsonOf(response).then((value) => value['field'])).toBe('promise_id');
    expect(s.rpcCalls).toEqual([]);
  });

  test('RPC comment 길이 E_VALIDATION은 comment 필드로 매핑한다', async () => {
    const local = spy({ rpc: async () => Promise.reject(new Error('E_VALIDATION')) });
    const response = await createFulfillmentSubmitHandler(local.deps)(
      mutationRequest({ promise_id: PROMISE_ID, answer: 'KEPT', comment: '가'.repeat(201) }),
    );
    expect(response.status).toBe(422);
    expect(await jsonOf(response).then((value) => value['field'])).toBe('comment');
  });

  test('알 수 없는 RPC 실패는 내용 없이 EC-C02 500으로 평탄화한다', async () => {
    const local = spy({ rpc: async () => Promise.reject(new Error('column secret_answer failed')) });
    const response = await createFulfillmentSubmitHandler(local.deps)(
      mutationRequest({
        promise_id: PROMISE_ID,
        answer: 'NOT_KEPT',
        comment: '외부에 나오면 안 되는 의견',
      }),
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe(
      '{"code":"E_INTERNAL","message":"처리 중 문제가 발생했습니다. 다시 시도해 주세요."}',
    );
    expect(JSON.stringify(local.logs)).not.toContain('외부에 나오면 안 되는 의견');
  });
});

describe('fulfillment-reopen', () => {
  test('Origin에서 WEB을 파생해 재확인 RPC에 정확히 넘긴다', async () => {
    const s = spy({ payload: REOPEN_PAYLOAD });
    const response = await createFulfillmentReopenHandler(s.deps)(
      mutationRequest(
        { promise_id: PROMISE_ID },
        { origin: 'https://littlefinger.pages.dev' },
      ),
    );
    expect(response.status).toBe(200);
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_fulfillment_reopen',
        args: {
          p_actor: ACTOR_ID,
          p_idempotency_key: KEY,
          p_promise_id: PROMISE_ID,
          p_surface: 'WEB',
        },
      },
    ]);
  });

  test('promise_id와 Idempotency-Key가 모두 필요하다', async () => {
    for (const input of [
      request({ body: {} }),
      mutationRequest({ promise_id: 'bad' }),
    ]) {
      const s = spy({ payload: REOPEN_PAYLOAD });
      const response = await createFulfillmentReopenHandler(s.deps)(input);
      expect(response.status).toBe(422);
      expect(s.rpcCalls).toEqual([]);
    }
  });

});
