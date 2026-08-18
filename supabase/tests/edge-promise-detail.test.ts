import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const HANDLER_PATH = '../functions/promise-detail/handler.ts';

interface HandlerModule {
  createPromiseDetailHandler: (deps: Deps) => (request: Request) => Promise<Response>;
}

const VERSION = {
  version_no: 1,
  title: '매일 함께 걷기',
  body: '매일 저녁 함께 걸어요.',
  category: 'HABIT',
  end_date: '2026-09-01',
  keeper: 'BOTH',
  reward: null,
  penalty: null,
  content_hash: 'a'.repeat(64),
  fingerprint: 'AAAA-AAAA-AA',
  activated_at: '2026-08-01T00:00:00Z',
  superseded_at: null,
  change_reason: null,
} as const;

const RESPONSE = {
  promise_id: PROMISE_ID,
  status: 'ACTIVE',
  title: VERSION.title,
  body: VERSION.body,
  category: VERSION.category,
  end_date: VERSION.end_date,
  keeper: VERSION.keeper,
  reward: VERSION.reward,
  penalty: VERSION.penalty,
  witness_enabled: false,
  activated_at: '2026-08-01T00:00:00Z',
  closed_at: null,
  checking_started_at: null,
  check_deadline_at: null,
  check_round_no: 1,
  my_role: 'CREATOR',
  counterpart_push_available: false,
  creator: {
    user_id: ACTOR_ID,
    nickname: '작성자',
    profile_image_url: null,
    role: 'CREATOR',
    status: 'JOINED',
    joined_at: '2026-07-31T00:00:00Z',
  },
  partner: {
    user_id: PARTNER_ID,
    nickname: '상대방',
    profile_image_url: null,
    role: 'PARTNER',
    status: 'JOINED',
    joined_at: '2026-08-01T00:00:00Z',
  },
  witnesses: [],
  approvals: [],
  current_version: VERSION,
  invitation: null,
  amend_request: null,
  fulfillment: null,
  integrity_status: 'VERIFIED',
} as const;

const { integrity_status: _internalIntegrity, ...PUBLIC_RESPONSE } = RESPONSE;

async function loadHandler(): Promise<HandlerModule | null> {
  return (await import(/* @vite-ignore */ HANDLER_PATH).catch(() => null)) as HandlerModule | null;
}

function createSpy(options: {
  payload?: unknown;
  authenticate?: (authorization: string | null) => Promise<string>;
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
} = {}) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const logs: { message: string; detail: unknown }[] = [];
  const deps: Deps = {
    authenticate: options.authenticate ?? (async () => ACTOR_ID),
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      return options.rpc === undefined ? options.payload : await options.rpc(fn, args);
    },
    secrets: { invitePepper: 'unused', piiSalt: 'unused' },
    log: { error: (message, detail) => logs.push({ message, detail }) },
    now: () => new Date('2026-08-16T00:00:00Z'),
  };
  return { deps, rpcCalls, logs };
}

function request(options: { body?: unknown; method?: string; authorization?: string } = {}): Request {
  return new Request('https://ref.supabase.co/functions/v1/promise-detail', {
    method: options.method ?? 'POST',
    headers: { authorization: options.authorization ?? 'Bearer jwt' },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('SCR-A05 promise-detail Edge Function', () => {
  let module: HandlerModule | null;

  beforeEach(async () => {
    module = await loadHandler();
  });

  test('Deno 전역 없는 순수 handler를 제공한다', () => {
    expect(module?.createPromiseDetailHandler).toBeTypeOf('function');
  });

  test('EC-G01 상대의 푸시 수신 가능 여부를 포함한 공개 snapshot을 반환한다', async () => {
    const spy = createSpy({ payload: RESPONSE });
    const response = await module!.createPromiseDetailHandler(spy.deps)(
      request({ body: { promise_id: PROMISE_ID } }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toEqual(PUBLIC_RESPONSE);
    expect(payload.counterpart_push_available).toBe(false);
    expect(payload).not.toHaveProperty('integrity_status');
    expect(spy.rpcCalls).toEqual([
      { fn: 'lf_promise_detail', args: { p_actor: ACTOR_ID, p_promise_id: PROMISE_ID } },
    ]);
  });

  test.each([
    [{}, 'promise_id'],
    [{ promise_id: 'bad' }, 'promise_id'],
    [{ promise_id: PROMISE_ID, extra: true }, 'promise_id'],
  ] as const)('잘못된 요청 %j는 RPC 전에 거부한다', async (body, field) => {
    const spy = createSpy({ payload: RESPONSE });
    const response = await module!.createPromiseDetailHandler(spy.deps)(request({ body }));

    expect(response.status).toBe(422);
    expect((await jsonOf(response)).field).toBe(field);
    expect(spy.rpcCalls).toEqual([]);
  });

  test('JWT 검증 실패는 body 파싱과 RPC보다 먼저 끝난다', async () => {
    const spy = createSpy({
      authenticate: async () => {
        throw new ApiError('E_AUTH_REQUIRED');
      },
    });
    const response = await module!.createPromiseDetailHandler(spy.deps)(
      request({ body: { promise_id: PROMISE_ID, extra: true } }),
    );

    expect(response.status).toBe(401);
    expect(spy.rpcCalls).toEqual([]);
  });

  test('RPC 응답이 엄격 공개 계약을 벗어나면 공통 500으로 평탄화한다', async () => {
    const spy = createSpy({ payload: { ...RESPONSE, storage_path: '/private/full.jpg' } });
    const response = await module!.createPromiseDetailHandler(spy.deps)(
      request({ body: { promise_id: PROMISE_ID } }),
    );

    expect(response.status).toBe(500);
    expect(await jsonOf(response)).toMatchObject({ code: 'E_INTERNAL' });
    expect(JSON.stringify(spy.logs)).not.toContain('/private/full.jpg');
  });

  test('비참여자와 숨겨진 약속은 같은 E_NOT_FOUND 응답이다', async () => {
    const spy = createSpy({
      rpc: async () => {
        throw new Error('E_NOT_FOUND');
      },
    });
    const response = await module!.createPromiseDetailHandler(spy.deps)(
      request({ body: { promise_id: PROMISE_ID } }),
    );

    expect(response.status).toBe(404);
    expect(await jsonOf(response)).toMatchObject({ code: 'E_NOT_FOUND' });
  });

  test('OPTIONS만 204이고 POST 외 method는 검증 오류다', async () => {
    const spy = createSpy({ payload: RESPONSE });
    const options = await module!.createPromiseDetailHandler(spy.deps)(request({ method: 'OPTIONS' }));
    const get = await module!.createPromiseDetailHandler(spy.deps)(request({ method: 'GET' }));

    expect(options.status).toBe(204);
    expect(get.status).toBe(422);
    expect(spy.rpcCalls).toEqual([]);
  });
});
