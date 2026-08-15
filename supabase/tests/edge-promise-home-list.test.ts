import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const HANDLER_PATH = '../functions/promise-home-list/handler.ts';

interface HandlerModule {
  createPromiseHomeListHandler: (deps: Deps) => (request: Request) => Promise<Response>;
}

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  logs: { message: string; detail: unknown }[];
}

const CARD = {
  promise_id: PROMISE_ID,
  title: '매일 함께 걷기',
  status: 'ACTIVE',
  end_date: '2026-08-30',
  updated_at: '2026-08-16T00:00:00Z',
  closed_at: null,
  my_role: 'CREATOR',
  creator: { nickname: '작성자', profile_image_url: null },
  partner: { nickname: '상대방', profile_image_url: null },
  has_witness: false,
  needs_response: false,
} as const;

const RESPONSE = {
  items: [CARD],
  pinned: [],
  counts: { ACTIVE: 1, WAITING: 0, COMPLETED: 0 },
  next_cursor: null,
} as const;

async function loadHandler(): Promise<HandlerModule | null> {
  return (await import(/* @vite-ignore */ HANDLER_PATH).catch(() => null)) as HandlerModule | null;
}

function spy(options: {
  payload?: unknown;
  authenticate?: (authorization: string | null) => Promise<string>;
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
} = {}): Spy {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const logs: { message: string; detail: unknown }[] = [];
  return {
    rpcCalls,
    logs,
    deps: {
      authenticate: options.authenticate ?? (async () => ACTOR_ID),
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return options.rpc === undefined ? options.payload : await options.rpc(fn, args);
      },
      secrets: { invitePepper: 'unused', piiSalt: 'unused' },
      log: { error: (message, detail) => logs.push({ message, detail }) },
      now: () => new Date('2026-08-16T00:00:00Z'),
    },
  };
}

function request(options: { body?: unknown; method?: string } = {}): Request {
  return new Request('https://ref.supabase.co/functions/v1/promise-home-list', {
    method: options.method ?? 'POST',
    headers: { authorization: 'Bearer jwt' },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('F-10 promise-home-list Edge Function', () => {
  let module: HandlerModule | null;

  beforeEach(async () => {
    module = await loadHandler();
  });

  test('Deno 전역 없는 순수 handler를 제공한다', () => {
    expect(module?.createPromiseHomeListHandler).toBeTypeOf('function');
  });

  test('JWT actor와 ACTIVE 탭만 보내고 서버 현재 시각·page size를 클라이언트가 정하지 않는다', async () => {
    const s = spy({ payload: RESPONSE });
    const response = await module!.createPromiseHomeListHandler(s.deps)(
      request({ body: { tab: 'ACTIVE' } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(RESPONSE);
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_promise_home_list',
        args: { p_actor: ACTOR_ID, p_tab: 'ACTIVE', p_cursor: null },
      },
    ]);
  });

  test.each([
    [
      'ACTIVE',
      {
        tab: 'ACTIVE',
        status_rank: 1,
        end_date: '2026-08-30',
        promise_id: PROMISE_ID,
      },
    ],
    [
      'WAITING',
      { tab: 'WAITING', updated_at: '2026-08-16T00:00:00Z', promise_id: PROMISE_ID },
    ],
    [
      'COMPLETED',
      {
        tab: 'COMPLETED',
        closed_at: null,
        updated_at: '2026-08-16T00:00:00Z',
        promise_id: PROMISE_ID,
      },
    ],
  ] as const)('%s cursor를 손실 없이 RPC에 전달한다', async (tab, cursor) => {
    const payload = { ...RESPONSE, items: [], counts: { ACTIVE: 0, WAITING: 0, COMPLETED: 0 } };
    const s = spy({ payload });
    const response = await module!.createPromiseHomeListHandler(s.deps)(
      request({ body: { tab, cursor } }),
    );

    expect(response.status).toBe(200);
    expect(s.rpcCalls[0]?.args).toEqual({ p_actor: ACTOR_ID, p_tab: tab, p_cursor: cursor });
  });

  test.each([
    [{}, 'tab'],
    [{ tab: 'UNKNOWN' }, 'tab'],
    [{ tab: 'ACTIVE', extra: true }, 'tab'],
    [{ tab: 'ACTIVE', cursor: [] }, 'cursor'],
    [
      {
        tab: 'ACTIVE',
        cursor: { tab: 'WAITING', updated_at: '2026-08-16T00:00:00Z', promise_id: PROMISE_ID },
      },
      'cursor',
    ],
    [
      {
        tab: 'ACTIVE',
        cursor: {
          tab: 'ACTIVE',
          status_rank: 2,
          end_date: '2026-08-30',
          promise_id: PROMISE_ID,
        },
      },
      'cursor',
    ],
    [
      {
        tab: 'ACTIVE',
        cursor: {
          tab: 'ACTIVE',
          status_rank: 1,
          end_date: '2026-02-30',
          promise_id: PROMISE_ID,
        },
      },
      'cursor',
    ],
    [
      {
        tab: 'WAITING',
        cursor: { tab: 'WAITING', updated_at: 'bad', promise_id: PROMISE_ID },
      },
      'cursor',
    ],
    [
      {
        tab: 'COMPLETED',
        cursor: {
          tab: 'COMPLETED',
          closed_at: 'bad',
          updated_at: '2026-08-16T00:00:00Z',
          promise_id: PROMISE_ID,
        },
      },
      'cursor',
    ],
    [
      {
        tab: 'WAITING',
        cursor: { tab: 'WAITING', updated_at: '2026-08-16T00:00:00Z', promise_id: 'bad' },
      },
      'cursor',
    ],
  ] as const)('잘못된 요청 %j는 %s 검증 오류로 RPC 전에 막는다', async (body, field) => {
    const s = spy({ payload: RESPONSE });
    const response = await module!.createPromiseHomeListHandler(s.deps)(request({ body }));

    expect(response.status).toBe(422);
    expect((await jsonOf(response)).field).toBe(field);
    expect(s.rpcCalls).toEqual([]);
  });

  test('JWT 검증 실패는 body와 RPC보다 먼저 끝난다', async () => {
    const s = spy({
      authenticate: async () => {
        throw new ApiError('E_AUTH_REQUIRED');
      },
    });
    const response = await module!.createPromiseHomeListHandler(s.deps)(
      request({ body: { tab: 'ACTIVE' } }),
    );

    expect(response.status).toBe(401);
    expect(s.rpcCalls).toEqual([]);
  });

  test('RPC 공개 응답이 엄격 계약을 벗어나면 공통 500으로 평탄화한다', async () => {
    const s = spy({ payload: { ...RESPONSE, storage_path: '/private/home.json' } });
    const response = await module!.createPromiseHomeListHandler(s.deps)(
      request({ body: { tab: 'ACTIVE' } }),
    );

    expect(response.status).toBe(500);
    expect(await jsonOf(response)).toMatchObject({ code: 'E_INTERNAL' });
    expect(s.logs).toEqual([
      { message: 'unmapped RPC failure', detail: { reason: 'UNMAPPED_ERROR' } },
    ]);
  });

  test('RPC E_NOT_FOUND는 존재를 드러내지 않는 404 계약을 유지한다', async () => {
    const s = spy({
      rpc: async () => {
        throw new Error('E_NOT_FOUND');
      },
    });
    const response = await module!.createPromiseHomeListHandler(s.deps)(
      request({ body: { tab: 'ACTIVE' } }),
    );

    expect(response.status).toBe(404);
    expect(await jsonOf(response)).toMatchObject({ code: 'E_NOT_FOUND' });
  });

  test('OPTIONS만 204이고 POST 외 method는 검증 오류다', async () => {
    const s = spy({ payload: RESPONSE });
    const options = await module!.createPromiseHomeListHandler(s.deps)(request({ method: 'OPTIONS' }));
    const get = await module!.createPromiseHomeListHandler(s.deps)(request({ method: 'GET' }));

    expect(options.status).toBe(204);
    expect(get.status).toBe(422);
    expect(s.rpcCalls).toEqual([]);
  });
});
