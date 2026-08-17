import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333';
const INVITATION_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555';
const TOKEN = 'A'.repeat(43);
const PEPPER = 'witness-pepper';
const PII_SALT = 'witness-pii-salt';

type Handler = (request: Request) => Promise<Response>;
type FactoryName =
  | 'createWitnessInviteListHandler'
  | 'createWitnessInviteHandler'
  | 'createWitnessJoinHandler'
  | 'createWitnessDetailHandler'
  | 'createWitnessSignHandler'
  | 'createWitnessLeaveHandler';

const MODULES: Record<FactoryName, string> = {
  createWitnessInviteListHandler: '../functions/witness-invite-list/handler.ts',
  createWitnessInviteHandler: '../functions/witness-invite/handler.ts',
  createWitnessJoinHandler: '../functions/witness-join/handler.ts',
  createWitnessDetailHandler: '../functions/witness-detail/handler.ts',
  createWitnessSignHandler: '../functions/witness-sign/handler.ts',
  createWitnessLeaveHandler: '../functions/witness-leave/handler.ts',
};

const LIST_RESPONSE = {
  promise_id: PROMISE_ID,
  occupied_count: 0,
  capacity: 2,
  witnesses: [],
} as const;

const JOIN_RESPONSE = {
  promise_id: PROMISE_ID,
  participant_id: PARTICIPANT_ID,
  status: 'JOINED',
} as const;

const DETAIL_RESPONSE = {
  promise_id: PROMISE_ID,
  status: 'PENDING',
  visibility: 'LIMITED',
  title: '매일 걷기',
  creator: {
    user_id: ACTOR_ID,
    nickname: '작성자',
    profile_image_url: null,
  },
  partner: null,
  activated_at: null,
  signed_at: null,
  content: null,
  fulfillment: null,
} as const;

const SIGN_RESPONSE = {
  promise_id: PROMISE_ID,
  signed_at: '2026-08-17T00:00:00Z',
} as const;

const LEAVE_RESPONSE = {
  promise_id: PROMISE_ID,
  status: 'WITHDRAWN',
} as const;

const factories = new Map<FactoryName, ((deps: Deps) => Handler) | null>();

beforeAll(async () => {
  for (const [name, path] of Object.entries(MODULES) as [FactoryName, string][]) {
    const module = await import(/* @vite-ignore */ path).catch(() => null) as Record<string, unknown> | null;
    factories.set(name, (module?.[name] as ((deps: Deps) => Handler) | undefined) ?? null);
  }
});

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
    secrets: { invitePepper: PEPPER, piiSalt: PII_SALT },
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
  if (options.idempotency !== null) headers.set('idempotency-key', options.idempotency ?? IDEMPOTENCY_KEY);
  return new Request(`https://ref.supabase.co/functions/v1/${slug}`, {
    method,
    headers,
    ...(['GET', 'HEAD', 'OPTIONS'].includes(method) ? {} : { body: JSON.stringify(body) }),
  });
}

function factory(name: FactoryName): (deps: Deps) => Handler {
  return factories.get(name)!;
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe('F-05 witness Edge Functions', () => {
  test.each(Object.keys(MODULES) as FactoryName[])('%s is an importable pure handler', (name) => {
    expect(factories.get(name)).toBeTypeOf('function');
  });

  test('list and detail authenticate and call read-only RPCs without idempotency keys', async () => {
    const listSpy = createSpy({ payload: LIST_RESPONSE });
    const detailSpy = createSpy({ payload: DETAIL_RESPONSE });

    const listResponse = await factory('createWitnessInviteListHandler')(listSpy.deps)(
      request('witness-invite-list', { promise_id: PROMISE_ID }, { idempotency: null }),
    );
    const detailResponse = await factory('createWitnessDetailHandler')(detailSpy.deps)(
      request('witness-detail', { promise_id: PROMISE_ID }, { idempotency: null }),
    );

    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(listSpy.rpcCalls).toEqual([
      { fn: 'lf_witness_invite_list', args: { p_actor: ACTOR_ID, p_promise_id: PROMISE_ID } },
    ]);
    expect(detailSpy.rpcCalls).toEqual([
      { fn: 'lf_witness_detail', args: { p_actor: ACTOR_ID, p_promise_id: PROMISE_ID } },
    ]);
  });

  test('invite issues one token, sends only its hash, and strips the stored hash', async () => {
    const spy = createSpy({
      rpc: async (_fn, args) => ({
        promise_id: PROMISE_ID,
        participant_id: PARTICIPANT_ID,
        invitation_id: INVITATION_ID,
        title: '매일 걷기',
        expires_at: '2026-08-20T00:00:00Z',
        token_hash: args['p_token_hash'],
      }),
    });

    const response = await factory('createWitnessInviteHandler')(spy.deps)(
      request('witness-invite', { promise_id: PROMISE_ID, participant_id: PARTICIPANT_ID }),
    );
    const payload = await jsonOf(response);
    const token = String(payload['token']);

    expect(response.status).toBe(200);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(payload).not.toHaveProperty('token_hash');
    expect(JSON.stringify(spy.rpcCalls)).not.toContain(token);
    expect(spy.rpcCalls).toEqual([
      {
        fn: 'lf_witness_invite',
        args: {
          p_idempotency_key: IDEMPOTENCY_KEY,
          p_actor: ACTOR_ID,
          p_promise_id: PROMISE_ID,
          p_token_hash: createHash('sha256').update(token + PEPPER).digest('hex'),
          p_participant_id: PARTICIPANT_ID,
        },
      },
    ]);
  });

  test('invite replay with another stored hash never returns an unusable token', async () => {
    const spy = createSpy({
      payload: {
        promise_id: PROMISE_ID,
        participant_id: PARTICIPANT_ID,
        invitation_id: INVITATION_ID,
        title: '매일 걷기',
        expires_at: '2026-08-20T00:00:00Z',
        token_hash: 'f'.repeat(64),
      },
    });
    const response = await factory('createWitnessInviteHandler')(spy.deps)(
      request('witness-invite', { promise_id: PROMISE_ID }),
    );
    expect(await jsonOf(response)).not.toHaveProperty('token');
  });

  test('join hashes the raw token and passes the mutation idempotency key exactly', async () => {
    const spy = createSpy({ payload: JOIN_RESPONSE });
    const response = await factory('createWitnessJoinHandler')(spy.deps)(
      request('witness-join', { token: TOKEN }),
    );

    expect(response.status).toBe(200);
    expect(spy.rpcCalls).toEqual([
      {
        fn: 'lf_witness_join',
        args: {
          p_idempotency_key: IDEMPOTENCY_KEY,
          p_actor: ACTOR_ID,
          p_token_hash: createHash('sha256').update(TOKEN + PEPPER).digest('hex'),
        },
      },
    ]);
  });

  test('sign derives WEB surface and nullable PII hashes from headers only', async () => {
    const spy = createSpy({ payload: SIGN_RESPONSE });
    const response = await factory('createWitnessSignHandler')(spy.deps)(
      request('witness-sign', { promise_id: PROMISE_ID }, {
        headers: {
          origin: 'https://littlefinger.pages.dev',
          'cf-connecting-ip': '203.0.113.4',
          'user-agent': 'witness-browser',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(spy.rpcCalls).toEqual([
      {
        fn: 'lf_witness_sign',
        args: {
          p_idempotency_key: IDEMPOTENCY_KEY,
          p_actor: ACTOR_ID,
          p_promise_id: PROMISE_ID,
          p_surface: 'WEB',
          p_ip_hash: createHash('sha256').update(`203.0.113.4${PII_SALT}`).digest('hex'),
          p_user_agent_hash: createHash('sha256').update(`witness-browser${PII_SALT}`).digest('hex'),
        },
      },
    ]);

    const noPiiSpy = createSpy({ payload: SIGN_RESPONSE });
    await factory('createWitnessSignHandler')(noPiiSpy.deps)(
      request('witness-sign', { promise_id: PROMISE_ID }),
    );
    expect(noPiiSpy.rpcCalls[0]?.args).toMatchObject({
      p_surface: 'APP',
      p_ip_hash: null,
      p_user_agent_hash: null,
    });
  });

  test('leave sends only actor promise and mutation idempotency key', async () => {
    const spy = createSpy({ payload: LEAVE_RESPONSE });
    const response = await factory('createWitnessLeaveHandler')(spy.deps)(
      request('witness-leave', { promise_id: PROMISE_ID }),
    );

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual(LEAVE_RESPONSE);
    expect(spy.rpcCalls).toEqual([{
      fn: 'lf_witness_leave',
      args: {
        p_idempotency_key: IDEMPOTENCY_KEY,
        p_actor: ACTOR_ID,
        p_promise_id: PROMISE_ID,
      },
    }]);
  });

  test.each([
    ['createWitnessInviteHandler', 'witness-invite', { promise_id: PROMISE_ID }],
    ['createWitnessJoinHandler', 'witness-join', { token: TOKEN }],
    ['createWitnessSignHandler', 'witness-sign', { promise_id: PROMISE_ID }],
    ['createWitnessLeaveHandler', 'witness-leave', { promise_id: PROMISE_ID }],
  ] as const)('%s requires a UUID Idempotency-Key before RPC', async (name, slug, body) => {
    const spy = createSpy({ payload: SIGN_RESPONSE });
    const response = await factory(name)(spy.deps)(
      request(slug, body, { idempotency: null }),
    );
    expect(response.status).toBe(422);
    expect((await jsonOf(response))['field']).toBe('idempotency_key');
    expect(spy.rpcCalls).toEqual([]);
  });

  test('authentication happens before malformed body or idempotency validation', async () => {
    const spy = createSpy({
      authenticate: async () => {
        throw new ApiError('E_AUTH_REQUIRED');
      },
    });
    const response = await factory('createWitnessInviteHandler')(spy.deps)(
      request('witness-invite', { promise_id: 'bad', extra: true }, { idempotency: null }),
    );
    expect(response.status).toBe(401);
    expect(spy.rpcCalls).toEqual([]);
  });

  test.each([
    ['createWitnessInviteListHandler', 'witness-invite-list', { promise_id: PROMISE_ID, extra: true }, 'promise_id'],
    ['createWitnessInviteHandler', 'witness-invite', { promise_id: 'bad' }, 'promise_id'],
    ['createWitnessInviteHandler', 'witness-invite', { promise_id: PROMISE_ID, participant_id: 'bad' }, 'participant_id'],
    ['createWitnessJoinHandler', 'witness-join', { token: 'short' }, 'token'],
    ['createWitnessDetailHandler', 'witness-detail', {}, 'promise_id'],
    ['createWitnessSignHandler', 'witness-sign', { promise_id: PROMISE_ID, surface: 'APP' }, 'promise_id'],
    ['createWitnessLeaveHandler', 'witness-leave', { promise_id: PROMISE_ID, extra: true }, 'promise_id'],
  ] as const)('%s rejects malformed exact body before RPC', async (name, slug, body, field) => {
    const spy = createSpy({ payload: LIST_RESPONSE });
    const response = await factory(name)(spy.deps)(request(slug, body));
    expect(response.status).toBe(422);
    expect((await jsonOf(response))['field']).toBe(field);
    expect(spy.rpcCalls).toEqual([]);
  });

  test.each([
    ['createWitnessInviteListHandler', 'witness-invite-list', LIST_RESPONSE, { promise_id: PROMISE_ID }],
    ['createWitnessInviteHandler', 'witness-invite', {
      promise_id: PROMISE_ID,
      participant_id: PARTICIPANT_ID,
      invitation_id: INVITATION_ID,
      title: '매일 걷기',
      expires_at: '2026-08-20T00:00:00Z',
    }, { promise_id: PROMISE_ID }],
    ['createWitnessJoinHandler', 'witness-join', JOIN_RESPONSE, { token: TOKEN }],
    ['createWitnessDetailHandler', 'witness-detail', DETAIL_RESPONSE, { promise_id: PROMISE_ID }],
    ['createWitnessSignHandler', 'witness-sign', SIGN_RESPONSE, { promise_id: PROMISE_ID }],
    ['createWitnessLeaveHandler', 'witness-leave', LEAVE_RESPONSE, { promise_id: PROMISE_ID }],
  ] as const)('%s rejects an RPC response outside the strict public contract', async (name, slug, payload, body) => {
    const spy = createSpy({ payload: { ...payload, private_path: '/secret/object.jpg' } });
    const response = await factory(name)(spy.deps)(request(slug, body));
    expect(response.status).toBe(500);
    expect(await jsonOf(response)).toMatchObject({ code: 'E_INTERNAL' });
    expect(JSON.stringify(spy.logs)).not.toContain('/secret/object.jpg');
  });

  test('known RPC errors map while unknown errors and sensitive messages flatten safely', async () => {
    const known = createSpy({ rpc: async () => { throw new Error('E_WITNESS_LIMIT'); } });
    const knownResponse = await factory('createWitnessInviteHandler')(known.deps)(
      request('witness-invite', { promise_id: PROMISE_ID }),
    );
    expect(knownResponse.status).toBe(422);
    expect(await jsonOf(knownResponse)).toMatchObject({ code: 'E_WITNESS_LIMIT' });

    const sensitive = `${TOKEN}/i/${TOKEN}`;
    const unknown = createSpy({ rpc: async () => { throw new Error(sensitive); } });
    const unknownResponse = await factory('createWitnessJoinHandler')(unknown.deps)(
      request('witness-join', { token: TOKEN }),
    );
    expect(unknownResponse.status).toBe(500);
    expect(await jsonOf(unknownResponse)).toMatchObject({ code: 'E_INTERNAL' });
    expect(JSON.stringify(unknown.logs)).not.toContain(TOKEN);
  });

  test.each(Object.entries(MODULES) as [FactoryName, string][])('%s supports OPTIONS and rejects GET', async (name, path) => {
    const slug = path.split('/')[2] ?? 'witness-detail';
    const spy = createSpy({ payload: LIST_RESPONSE });
    const options = await factory(name)(spy.deps)(request(slug, {}, { method: 'OPTIONS' }));
    const get = await factory(name)(spy.deps)(request(slug, {}, { method: 'GET' }));
    expect(options.status).toBe(204);
    expect(get.status).toBe(422);
    expect(spy.rpcCalls).toEqual([]);
  });
});
