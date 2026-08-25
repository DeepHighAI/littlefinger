import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444';
const PII_SALT = 'f11-pii-salt';

type Handler = (request: Request) => Promise<Response>;
type FactoryName =
  | 'createPromiseAmendRequestHandler'
  | 'createPromiseAmendRespondHandler'
  | 'createPromiseAmendWithdrawHandler'
  | 'createPromiseVersionListHandler';

const MODULES: Record<FactoryName, string> = {
  createPromiseAmendRequestHandler: '../functions/promise-amend-request/handler.ts',
  createPromiseAmendRespondHandler: '../functions/promise-amend-respond/handler.ts',
  createPromiseAmendWithdrawHandler: '../functions/promise-amend-withdraw/handler.ts',
  createPromiseVersionListHandler: '../functions/promise-version-list/handler.ts',
};

const CREATE_RESPONSE = {
  promise_id: PROMISE_ID,
  status: 'AMEND_PENDING',
  request_id: REQUEST_ID,
  type: 'AMEND',
  expires_at: '2026-08-24T00:00:00Z',
} as const;

const RESPOND_RESPONSE = {
  promise_id: PROMISE_ID,
  status: 'ACTIVE',
  request_id: REQUEST_ID,
  request_status: 'APPROVED',
  version_no: 2,
} as const;

const WITHDRAW_RESPONSE = {
  promise_id: PROMISE_ID,
  status: 'ACTIVE',
  request_id: REQUEST_ID,
  request_status: 'WITHDRAWN',
} as const;

const VERSION_LIST_RESPONSE = {
  promise_id: PROMISE_ID,
  versions: [],
} as const;

const factories = new Map<FactoryName, ((deps: Deps) => Handler) | null>();

beforeAll(async () => {
  for (const [name, path] of Object.entries(MODULES) as [FactoryName, string][]) {
    const module = await import(/* @vite-ignore */ path).catch(() => null) as Record<string, unknown> | null;
    factories.set(name, (module?.[name] as ((deps: Deps) => Handler) | undefined) ?? null);
  }
});

function factory(name: FactoryName): (deps: Deps) => Handler {
  return factories.get(name) ?? (() => async () => new Response('{"code":"MISSING_HANDLER"}', {
    status: 599,
    headers: { 'Content-Type': 'application/json' },
  }));
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
    secrets: { invitePepper: 'unused', piiSalt: PII_SALT },
    log: { error: (message, detail) => logs.push({ message, detail }) },
    now: () => new Date('2026-08-17T00:00:00Z'),
  };
  return { deps, rpcCalls, logs };
}

function request(
  slug: string,
  body: unknown,
  options: {
    method?: string;
    idempotency?: string | null;
    authorization?: string | null;
    headers?: Record<string, string>;
  } = {},
): Request {
  const method = options.method ?? 'POST';
  const headers = new Headers(options.headers);
  if (options.authorization !== null) headers.set('authorization', options.authorization ?? 'Bearer jwt');
  if (options.idempotency !== null) {
    headers.set('idempotency-key', options.idempotency ?? IDEMPOTENCY_KEY);
  }
  return new Request(`https://ref.supabase.co/functions/v1/${slug}`, {
    method,
    headers,
    ...(['GET', 'HEAD', 'OPTIONS'].includes(method) ? {} : { body: JSON.stringify(body) }),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe('F-11 amend agreement Edge Functions', () => {
  test.each(Object.keys(MODULES) as FactoryName[])('%s is an importable pure handler', (name) => {
    expect(factories.get(name)).toBeTypeOf('function');
  });

  test('AMEND normalizes the proposal and derives WEB audit fields before the RPC', async () => {
    const spy = createSpy({ payload: CREATE_RESPONSE });
    const response = await factory('createPromiseAmendRequestHandler')(spy.deps)(
      request('promise-amend-request', {
        promise_id: PROMISE_ID,
        type: 'AMEND',
        proposed: {
          title: '  가속 걷기  ',
          body: '  하루 30분\n\n\n걷기  ',
          category: 'HABIT',
          end_date: '2026-09-01',
          keeper: 'BOTH',
          reward: '  커피  ',
          penalty: null,
        },
        reason: '  상황 변경  ',
      }, {
        headers: {
          origin: 'https://littlefinger-app.web.app',
          'cf-connecting-ip': '203.0.113.7',
          'user-agent': 'amend-browser',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(spy.rpcCalls).toEqual([{
      fn: 'lf_promise_amend_request',
      args: {
        p_idempotency_key: IDEMPOTENCY_KEY,
        p_actor: ACTOR_ID,
        p_promise_id: PROMISE_ID,
        p_type: 'AMEND',
        p_proposed: {
          title: '가속 걷기',
          body: '하루 30분\n\n걷기',
          category: 'HABIT',
          end_date: '2026-09-01',
          keeper: 'BOTH',
          reward: '커피',
          penalty: null,
        },
        p_reason: '상황 변경',
        p_surface: 'WEB',
        p_ip_hash: createHash('sha256').update(`203.0.113.7${PII_SALT}`).digest('hex'),
        p_user_agent_hash: createHash('sha256').update(`amend-browser${PII_SALT}`).digest('hex'),
      },
    }]);
  });

  test('CANCEL omits a proposal and keeps nullable audit hashes', async () => {
    const spy = createSpy({ payload: { ...CREATE_RESPONSE, type: 'CANCEL' } });
    const response = await factory('createPromiseAmendRequestHandler')(spy.deps)(
      request('promise-amend-request', {
        promise_id: PROMISE_ID,
        type: 'CANCEL',
        reason: '  서로 합의한 파기  ',
      }),
    );
    expect(response.status).toBe(200);
    expect(spy.rpcCalls[0]).toEqual({
      fn: 'lf_promise_amend_request',
      args: {
        p_idempotency_key: IDEMPOTENCY_KEY,
        p_actor: ACTOR_ID,
        p_promise_id: PROMISE_ID,
        p_type: 'CANCEL',
        p_proposed: null,
        p_reason: '서로 합의한 파기',
        p_surface: 'APP',
        p_ip_hash: null,
        p_user_agent_hash: null,
      },
    });
  });

  test('respond and withdraw pass the caller-owned idempotency key and audit surface', async () => {
    const respondSpy = createSpy({ payload: RESPOND_RESPONSE });
    const withdrawSpy = createSpy({ payload: WITHDRAW_RESPONSE });
    await factory('createPromiseAmendRespondHandler')(respondSpy.deps)(
      request('promise-amend-respond', {
        promise_id: PROMISE_ID,
        request_id: REQUEST_ID,
        decision: 'APPROVE',
      }, { headers: { origin: 'https://littlefinger-app.web.app' } }),
    );
    await factory('createPromiseAmendWithdrawHandler')(withdrawSpy.deps)(
      request('promise-amend-withdraw', { promise_id: PROMISE_ID, request_id: REQUEST_ID }),
    );

    expect(respondSpy.rpcCalls[0]).toEqual({
      fn: 'lf_promise_amend_respond',
      args: expect.objectContaining({
        p_idempotency_key: IDEMPOTENCY_KEY,
        p_actor: ACTOR_ID,
        p_promise_id: PROMISE_ID,
        p_request_id: REQUEST_ID,
        p_decision: 'APPROVE',
        p_surface: 'WEB',
      }),
    });
    expect(withdrawSpy.rpcCalls[0]).toEqual({
      fn: 'lf_promise_amend_withdraw',
      args: expect.objectContaining({
        p_idempotency_key: IDEMPOTENCY_KEY,
        p_actor: ACTOR_ID,
        p_promise_id: PROMISE_ID,
        p_request_id: REQUEST_ID,
        p_surface: 'APP',
      }),
    });
  });

  test('version list is read-only and rejects an Idempotency-Key', async () => {
    const readSpy = createSpy({ payload: VERSION_LIST_RESPONSE });
    const handler = factory('createPromiseVersionListHandler')(readSpy.deps);
    const ok = await handler(request(
      'promise-version-list',
      { promise_id: PROMISE_ID },
      { idempotency: null },
    ));
    const rejected = await handler(request('promise-version-list', { promise_id: PROMISE_ID }));

    expect(ok.status).toBe(200);
    expect(readSpy.rpcCalls).toEqual([{
      fn: 'lf_promise_version_list',
      args: { p_actor: ACTOR_ID, p_promise_id: PROMISE_ID },
    }]);
    expect(rejected.status).toBe(422);
    expect(await jsonOf(rejected)).toMatchObject({ code: 'E_VALIDATION', field: 'idempotency_key' });
  });

  test.each([
    ['CANCEL with proposal', { promise_id: PROMISE_ID, type: 'CANCEL', proposed: {} }],
    ['AMEND without proposal', { promise_id: PROMISE_ID, type: 'AMEND' }],
    ['unknown top-level field', { promise_id: PROMISE_ID, type: 'CANCEL', extra: true }],
    ['nullable optional reason', { promise_id: PROMISE_ID, type: 'CANCEL', reason: null }],
    ['invalid request UUID', { promise_id: PROMISE_ID, request_id: 'bad', decision: 'APPROVE' }],
  ] as const)('%s is rejected before any RPC', async (name, body) => {
    const isRespond = name === 'invalid request UUID';
    const factoryName = isRespond
      ? 'createPromiseAmendRespondHandler'
      : 'createPromiseAmendRequestHandler';
    const spy = createSpy({ payload: isRespond ? RESPOND_RESPONSE : CREATE_RESPONSE });
    const response = await factory(factoryName)(spy.deps)(
      request(isRespond ? 'promise-amend-respond' : 'promise-amend-request', body),
    );
    expect(response.status).toBe(422);
    expect(spy.rpcCalls).toEqual([]);
  });

  test('authentication happens before idempotency and body validation', async () => {
    const spy = createSpy({
      authenticate: async () => { throw new ApiError('E_AUTH_REQUIRED'); },
      payload: CREATE_RESPONSE,
    });
    const response = await factory('createPromiseAmendRequestHandler')(spy.deps)(
      request('promise-amend-request', null, { authorization: null, idempotency: null }),
    );
    expect(response.status).toBe(401);
    expect(spy.rpcCalls).toEqual([]);
  });

  test.each([
    ['createPromiseAmendRequestHandler', 'promise-amend-request', { promise_id: PROMISE_ID, type: 'CANCEL' }],
    ['createPromiseAmendRespondHandler', 'promise-amend-respond', { promise_id: PROMISE_ID, request_id: REQUEST_ID, decision: 'DECLINE' }],
    ['createPromiseAmendWithdrawHandler', 'promise-amend-withdraw', { promise_id: PROMISE_ID, request_id: REQUEST_ID }],
  ] as const)('%s requires a UUID Idempotency-Key', async (name, slug, body) => {
    const spy = createSpy({ payload: CREATE_RESPONSE });
    const response = await factory(name)(spy.deps)(
      request(slug, body, { idempotency: 'stale-key' }),
    );
    expect(response.status).toBe(422);
    expect(await jsonOf(response)).toMatchObject({ field: 'idempotency_key' });
    expect(spy.rpcCalls).toEqual([]);
  });

  test('strictly rejects malformed RPC success payloads', async () => {
    const spy = createSpy({ payload: { ...CREATE_RESPONSE, internal_requester_id: ACTOR_ID } });
    const response = await factory('createPromiseAmendRequestHandler')(spy.deps)(
      request('promise-amend-request', { promise_id: PROMISE_ID, type: 'CANCEL' }),
    );
    expect(response.status).toBe(500);
    expect(await jsonOf(response)).not.toHaveProperty('internal_requester_id');
  });

  test('maps known RPC errors and flattens unknown failures without logging request content', async () => {
    const sensitive = '외부에 노출되면 안 되는 이유';
    const knownSpy = createSpy({ rpc: async () => { throw new Error('E_STATE_CONFLICT'); } });
    const unknownSpy = createSpy({ rpc: async () => { throw new Error(`relation leaked ${sensitive}`); } });
    const body = { promise_id: PROMISE_ID, type: 'CANCEL', reason: sensitive };
    const known = await factory('createPromiseAmendRequestHandler')(knownSpy.deps)(
      request('promise-amend-request', body),
    );
    const unknown = await factory('createPromiseAmendRequestHandler')(unknownSpy.deps)(
      request('promise-amend-request', body),
    );

    expect(known.status).toBe(409);
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await jsonOf(unknown))).not.toContain('relation');
    expect(JSON.stringify(unknownSpy.logs)).not.toContain(sensitive);
  });

  test.each(Object.keys(MODULES) as FactoryName[])('%s handles OPTIONS without auth', async (name) => {
    const spy = createSpy({ authenticate: async () => { throw new Error('should not authenticate'); } });
    const response = await factory(name)(spy.deps)(request('endpoint', null, {
      method: 'OPTIONS',
      authorization: null,
      idempotency: null,
    }));
    expect(response.status).toBe(204);
  });
});
