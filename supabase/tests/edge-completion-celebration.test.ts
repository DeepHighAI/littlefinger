import { beforeAll, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const CLAIM_ID = '33333333-3333-4333-8333-333333333333';
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444';
const SHOWN_AT = '2026-08-17T09:00:00.000Z';

const AVAILABLE = {
  available: true,
  celebration: {
    claim_id: CLAIM_ID,
    promise_id: PROMISE_ID,
    title: '매일 걷기',
    counterpart_nickname: '민준',
    keep_rate_before: 87,
    keep_rate_after: 89,
  },
} as const;
const UNAVAILABLE = { available: false, celebration: null } as const;
const SHOWN = { promise_id: PROMISE_ID, shown_at: SHOWN_AT } as const;

type Handler = (request: Request) => Promise<Response>;
type Factory = (deps: Deps) => Handler;

interface RequestModule {
  completionCelebrationPromiseIdOf?: (body: Record<string, unknown>) => string;
  completionCelebrationShownInputOf?: (
    body: Record<string, unknown>,
  ) => { promiseId: string; claimId: string };
}

let claimFactory: Factory | undefined;
let shownFactory: Factory | undefined;
let requestModule: RequestModule | null;

beforeAll(async () => {
  const [claimModule, shownModule, parsedRequestModule] = await Promise.all([
    import('../functions/completion-celebration-claim/handler.ts').catch(() => null),
    import('../functions/completion-celebration-shown/handler.ts').catch(() => null),
    import('../functions/_shared/completion-celebration.ts').catch(() => null),
  ]);
  claimFactory = claimModule?.createCompletionCelebrationClaimHandler as Factory | undefined;
  shownFactory = shownModule?.createCompletionCelebrationShownHandler as Factory | undefined;
  requestModule = parsedRequestModule as RequestModule | null;
});

function spy(options: {
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
    now: () => new Date('2026-08-17T09:00:00.000Z'),
  };
  return { deps, rpcCalls, logs };
}

function request(
  slug: string,
  body: unknown,
  options: {
    method?: string;
    authorization?: string | null;
    idempotencyKey?: string | null;
  } = {},
): Request {
  const method = options.method ?? 'POST';
  const headers = new Headers({ 'content-type': 'application/json' });
  if (options.authorization !== null) {
    headers.set('authorization', options.authorization ?? 'Bearer jwt');
  }
  if (options.idempotencyKey !== null) {
    headers.set('idempotency-key', options.idempotencyKey ?? IDEMPOTENCY_KEY);
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

describe('MOD-03 Edge request parsing', () => {
  test('claim accepts exactly one valid promise UUID', () => {
    const parse = requestModule?.completionCelebrationPromiseIdOf;
    expect(parse).toBeTypeOf('function');
    expect(parse?.({ promise_id: PROMISE_ID })).toBe(PROMISE_ID);
    expect(() => parse?.({ promise_id: 'bad' })).toThrow('E_VALIDATION');
    expect(() => parse?.({ promise_id: PROMISE_ID, extra: true })).toThrow('E_VALIDATION');
  });

  test('shown accepts exactly the promise and claim UUIDs', () => {
    const parse = requestModule?.completionCelebrationShownInputOf;
    expect(parse).toBeTypeOf('function');
    expect(parse?.({ promise_id: PROMISE_ID, claim_id: CLAIM_ID })).toEqual({
      promiseId: PROMISE_ID,
      claimId: CLAIM_ID,
    });
    expect(() => parse?.({ promise_id: PROMISE_ID, claim_id: 'bad' })).toThrow(
      'E_VALIDATION',
    );
    expect(() =>
      parse?.({ promise_id: PROMISE_ID, claim_id: CLAIM_ID, extra: true }),
    ).toThrow('E_VALIDATION');
  });
});

describe('MOD-03 authenticated Edge handlers', () => {
  test('exports two reusable pure factories', () => {
    expect(claimFactory).toBeTypeOf('function');
    expect(shownFactory).toBeTypeOf('function');
  });

  test('claim passes JWT actor, retained key, and exact promise to RPC', async () => {
    const s = spy({ payload: AVAILABLE });
    const response = await claimFactory!(s.deps)(
      request('completion-celebration-claim', { promise_id: PROMISE_ID }),
    );

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual(AVAILABLE);
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_completion_celebration_claim',
        args: {
          p_idempotency_key: IDEMPOTENCY_KEY,
          p_actor: ACTOR_ID,
          p_promise_id: PROMISE_ID,
        },
      },
    ]);

    const reused = await claimFactory!(s.deps)(
      request('completion-celebration-claim', { promise_id: PROMISE_ID }),
    );
    expect(reused.status).toBe(200);
  });

  test('claim preserves the strict unavailable union', async () => {
    const s = spy({ payload: UNAVAILABLE });
    const response = await claimFactory!(s.deps)(
      request('completion-celebration-claim', { promise_id: PROMISE_ID }),
    );
    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual(UNAVAILABLE);
  });

  test('shown passes both identifiers and its separate key exactly', async () => {
    const s = spy({ payload: SHOWN });
    const response = await shownFactory!(s.deps)(
      request('completion-celebration-shown', {
        promise_id: PROMISE_ID,
        claim_id: CLAIM_ID,
      }),
    );

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual(SHOWN);
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_completion_celebration_shown',
        args: {
          p_idempotency_key: IDEMPOTENCY_KEY,
          p_actor: ACTOR_ID,
          p_promise_id: PROMISE_ID,
          p_claim_id: CLAIM_ID,
        },
      },
    ]);
  });

  test.each([
    ['claim', 'completion-celebration-claim', () => claimFactory!, { promise_id: PROMISE_ID }],
    [
      'shown',
      'completion-celebration-shown',
      () => shownFactory!,
      { promise_id: PROMISE_ID, claim_id: CLAIM_ID },
    ],
  ] as const)('%s handles OPTIONS and rejects non-POST methods', async (_name, slug, getFactory, body) => {
    const s = spy({ payload: AVAILABLE });
    const handler = getFactory()(s.deps);
    expect((await handler(request(slug, body, { method: 'OPTIONS' }))).status).toBe(204);
    expect((await handler(request(slug, body, { method: 'GET' }))).status).toBe(422);
    expect(s.rpcCalls).toEqual([]);
  });

  test.each([
    ['claim', 'completion-celebration-claim', () => claimFactory!, { promise_id: PROMISE_ID }],
    [
      'shown',
      'completion-celebration-shown',
      () => shownFactory!,
      { promise_id: PROMISE_ID, claim_id: CLAIM_ID },
    ],
  ] as const)('%s authenticates before request validation', async (_name, slug, getFactory, body) => {
    const s = spy({
      authenticate: async () => {
        throw new ApiError('E_AUTH_REQUIRED');
      },
    });
    const response = await getFactory()(s.deps)(
      request(slug, { ...body, extra: true }, { idempotencyKey: null }),
    );
    expect(response.status).toBe(401);
    expect(s.rpcCalls).toEqual([]);
  });

  test.each([
    ['claim', 'completion-celebration-claim', () => claimFactory!, { promise_id: PROMISE_ID }],
    [
      'shown',
      'completion-celebration-shown',
      () => shownFactory!,
      { promise_id: PROMISE_ID, claim_id: CLAIM_ID },
    ],
  ] as const)('%s requires a UUID idempotency key', async (_name, slug, getFactory, body) => {
    for (const key of [null, 'not-a-uuid']) {
      const s = spy({ payload: AVAILABLE });
      const response = await getFactory()(s.deps)(
        request(slug, body, { idempotencyKey: key }),
      );
      expect(response.status).toBe(422);
      expect((await jsonOf(response))['field']).toBe('idempotency_key');
      expect(s.rpcCalls).toEqual([]);
    }
  });

  test.each([
    ['claim', 'completion-celebration-claim', () => claimFactory!, AVAILABLE],
    ['shown', 'completion-celebration-shown', () => shownFactory!, SHOWN],
  ] as const)('%s rejects non-object JSON and exact-key violations', async (_name, slug, getFactory, payload) => {
    for (const body of [null, [], { promise_id: PROMISE_ID, extra: true }]) {
      const s = spy({ payload });
      const response = await getFactory()(s.deps)(request(slug, body));
      expect(response.status).toBe(422);
      expect(s.rpcCalls).toEqual([]);
    }
  });

  test('strict response parsers flatten malformed claim unions and shown instants', async () => {
    for (const [factory, slug, body, payload] of [
      [
        claimFactory!,
        'completion-celebration-claim',
        { promise_id: PROMISE_ID },
        { available: true, celebration: null },
      ],
      [
        claimFactory!,
        'completion-celebration-claim',
        { promise_id: PROMISE_ID },
        { ...AVAILABLE, private_path: '/private/row' },
      ],
      [
        shownFactory!,
        'completion-celebration-shown',
        { promise_id: PROMISE_ID, claim_id: CLAIM_ID },
        { promise_id: PROMISE_ID, shown_at: 'bad' },
      ],
    ] as const) {
      const s = spy({ payload });
      const response = await factory(s.deps)(request(slug, body));
      expect(response.status).toBe(500);
      expect(await jsonOf(response)).toMatchObject({ code: 'E_INTERNAL' });
    }
  });

  test('known not-found is preserved while unknown failures are flattened and safely logged', async () => {
    const known = spy({ rpc: async () => { throw new Error('E_NOT_FOUND'); } });
    const knownResponse = await claimFactory!(known.deps)(
      request('completion-celebration-claim', { promise_id: PROMISE_ID }),
    );
    expect(knownResponse.status).toBe(404);
    expect(await jsonOf(knownResponse)).toMatchObject({ code: 'E_NOT_FOUND' });

    const secret = `${PROMISE_ID}|${CLAIM_ID}|private-title`;
    const unknown = spy({ rpc: async () => { throw new Error(secret); } });
    const unknownResponse = await shownFactory!(unknown.deps)(
      request('completion-celebration-shown', {
        promise_id: PROMISE_ID,
        claim_id: CLAIM_ID,
      }),
    );
    expect(unknownResponse.status).toBe(500);
    expect(JSON.stringify(await jsonOf(unknownResponse))).not.toContain(secret);
    expect(JSON.stringify(unknown.logs)).not.toContain(secret);
    expect(unknown.logs).toEqual([
      { message: 'unmapped RPC failure', detail: { reason: 'UNMAPPED_ERROR' } },
    ]);
  });
});
