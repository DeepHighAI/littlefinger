import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const DRAFT_HANDLER_PATH = '../functions/promise-draft-update/handler.ts';
const REVOKE_HANDLER_PATH = '../functions/invite-revoke/handler.ts';
const USER_ID = 'a3bb6a17-6b7e-4bbf-9f0e-2f4c1d1a9e01';
const PROMISE_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3302';
const KEY = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const PEPPER = 'draft-update-pepper';
const NOW = new Date('2026-07-30T00:30:00Z');

const DRAFT_BODY = {
  promise_id: PROMISE_ID,
  title: '주 3회 달리기',
  body: '월요일 수요일 금요일에 함께 달린다',
  category: 'HABIT',
  end_date: '2026-08-30',
  keeper: 'BOTH',
  reward: '좋아하는 커피',
  penalty: '다음 모임 준비',
  witness_enabled: false,
};

interface DraftHandlerModule {
  createPromiseDraftUpdateHandler: (deps: Deps) => (request: Request) => Promise<Response>;
}

interface RevokeHandlerModule {
  createInviteRevokeHandler: (deps: Deps) => (request: Request) => Promise<Response>;
}

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
}

function spy(
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> = async (_, args) => ({
    promise_id: PROMISE_ID,
    status: args['p_token_hash'] === null ? 'DRAFT' : 'PENDING',
    invitation_id: 'invite-1',
    expires_at: '2026-08-02T00:30:00Z',
    resend_count: 0,
    title: '주 3회 달리기',
    token_hash: args['p_token_hash'],
  }),
): Spy {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    rpcCalls,
    deps: {
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return await rpc(fn, args);
      },
      authenticate: async (authorization) => {
        if (authorization === null) throw new ApiError('E_AUTH_REQUIRED');
        return USER_ID;
      },
      insertNotification: async () => {},
      secrets: { invitePepper: PEPPER, piiSalt: 'pii-salt' },
      log: { error: () => {} },
      now: () => NOW,
    },
  };
}

function request(body: unknown, headers?: Record<string, string>): Request {
  return new Request('https://ref.supabase.co/functions/v1/x', {
    method: 'POST',
    headers: headers ?? { authorization: 'Bearer jwt', 'idempotency-key': KEY },
    body: JSON.stringify(body),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function loadDraftHandler(): Promise<DraftHandlerModule | null> {
  return import(/* @vite-ignore */ DRAFT_HANDLER_PATH).catch(() => null) as Promise<DraftHandlerModule | null>;
}

async function loadRevokeHandler(): Promise<RevokeHandlerModule | null> {
  return import(/* @vite-ignore */ REVOKE_HANDLER_PATH).catch(() => null) as Promise<RevokeHandlerModule | null>;
}

describe('promise-draft-update Edge Function', () => {
  let module: DraftHandlerModule | null;

  beforeEach(async () => {
    module = await loadDraftHandler();
  });

  test('DRAFT 저장은 토큰 없이 전체 필드를 RPC로 넘긴다', async () => {
    expect(module?.createPromiseDraftUpdateHandler).toBeTypeOf('function');
    const s = spy();

    const response = await module!.createPromiseDraftUpdateHandler(s.deps)(request(DRAFT_BODY));

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({ promise_id: PROMISE_ID, status: 'DRAFT' });
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_promise_draft_update',
        args: {
          p_idempotency_key: KEY,
          p_user_id: USER_ID,
          p_promise_id: PROMISE_ID,
          p_title: DRAFT_BODY.title,
          p_body: DRAFT_BODY.body,
          p_category: DRAFT_BODY.category,
          p_end_date: DRAFT_BODY.end_date,
          p_keeper: DRAFT_BODY.keeper,
          p_reward: DRAFT_BODY.reward,
          p_penalty: DRAFT_BODY.penalty,
          p_witness_enabled: DRAFT_BODY.witness_enabled,
          p_token_hash: null,
        },
      },
    ]);
  });

  test('send=true면 원문 토큰은 응답에만, 해시는 RPC에만 둔다', async () => {
    expect(module?.createPromiseDraftUpdateHandler).toBeTypeOf('function');
    const s = spy();

    const body = await jsonOf(
      await module!.createPromiseDraftUpdateHandler(s.deps)(
        request({ ...DRAFT_BODY, send: true }),
      ),
    );
    const token = String(body['token']);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body['token_hash']).toBeUndefined();
    expect(s.rpcCalls[0]?.args['p_token_hash']).toBe(
      createHash('sha256')
        .update(token + PEPPER)
        .digest('hex'),
    );
    expect(JSON.stringify(s.rpcCalls[0]?.args)).not.toContain(token);
  });

  test('멱등 캐시의 해시가 다르면 새 원문 토큰을 응답하지 않는다', async () => {
    expect(module?.createPromiseDraftUpdateHandler).toBeTypeOf('function');
    const s = spy(async () => ({
      promise_id: PROMISE_ID,
      status: 'PENDING',
      token_hash: 'f'.repeat(64),
    }));

    const body = await jsonOf(
      await module!.createPromiseDraftUpdateHandler(s.deps)(
        request({ ...DRAFT_BODY, send: true }),
      ),
    );

    expect(body['token']).toBeUndefined();
    expect(body['token_hash']).toBeUndefined();
  });

  test.each([
    ['promise_id', { promise_id: 'not-a-uuid' }],
    ['title', { title: '한' }],
    ['body', { body: '짧음' }],
    ['category', { category: 'UNKNOWN' }],
    ['keeper', { keeper: 'WITNESS' }],
    ['end_date', { end_date: '2026-07-30' }],
    ['reward', { reward: '가'.repeat(101) }],
    ['penalty', { penalty: '가'.repeat(101) }],
  ])('%s 위반은 필드 오류이고 RPC를 부르지 않는다', async (field, override) => {
    expect(module?.createPromiseDraftUpdateHandler).toBeTypeOf('function');
    const s = spy();

    const response = await module!.createPromiseDraftUpdateHandler(s.deps)(
      request({ ...DRAFT_BODY, ...override }),
    );

    expect(response.status).toBe(422);
    expect((await jsonOf(response))['field']).toBe(field);
    expect(s.rpcCalls).toEqual([]);
  });

  test('JWT와 Idempotency-Key가 모두 필요하다', async () => {
    expect(module?.createPromiseDraftUpdateHandler).toBeTypeOf('function');
    const s = spy();
    const handler = module!.createPromiseDraftUpdateHandler(s.deps);

    const unauthenticated = await handler(request(DRAFT_BODY, {}));
    const noKey = await handler(request(DRAFT_BODY, { authorization: 'Bearer jwt' }));

    expect(unauthenticated.status).toBe(401);
    expect(noKey.status).toBe(422);
    expect((await jsonOf(noKey))['field']).toBe('idempotency_key');
    expect(s.rpcCalls).toEqual([]);
  });

  test('모르는 DB 실패는 내부 이름을 숨긴 500이다', async () => {
    expect(module?.createPromiseDraftUpdateHandler).toBeTypeOf('function');
    const s = spy(async () => {
      throw new Error('promise_versions_promise_id_version_no_key');
    });

    const response = await module!.createPromiseDraftUpdateHandler(s.deps)(request(DRAFT_BODY));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await jsonOf(response))).not.toContain('promise_versions');
  });
});

describe('invite-revoke Edge Function', () => {
  let module: RevokeHandlerModule | null;

  beforeEach(async () => {
    module = await loadRevokeHandler();
  });

  test('현재 JWT 사용자와 약속 ID로 무효화하고 PENDING 응답을 보존한다', async () => {
    expect(module?.createInviteRevokeHandler).toBeTypeOf('function');
    const s = spy(async () => ({
      promise_id: PROMISE_ID,
      status: 'PENDING',
      invitation_status: 'REVOKED',
    }));

    const response = await module!.createInviteRevokeHandler(s.deps)(
      request({ promise_id: PROMISE_ID }),
    );

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({
      promise_id: PROMISE_ID,
      status: 'PENDING',
      invitation_status: 'REVOKED',
    });
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_invite_revoke',
        args: {
          p_idempotency_key: KEY,
          p_user_id: USER_ID,
          p_promise_id: PROMISE_ID,
        },
      },
    ]);
  });

  test('promise_id가 UUID가 아니면 RPC에 닿지 않는다', async () => {
    expect(module?.createInviteRevokeHandler).toBeTypeOf('function');
    const s = spy();

    const response = await module!.createInviteRevokeHandler(s.deps)(
      request({ promise_id: 'wrong' }),
    );

    expect(response.status).toBe(422);
    expect((await jsonOf(response))['field']).toBe('promise_id');
    expect(s.rpcCalls).toEqual([]);
  });

  test.each([
    ['E_NOT_FOUND', 404],
    ['E_STATE_CONFLICT', 409],
    ['E_FORBIDDEN', 403],
  ])('%s는 %i로 매핑한다', async (code, status) => {
    expect(module?.createInviteRevokeHandler).toBeTypeOf('function');
    const s = spy(async () => {
      throw new Error(code);
    });

    const response = await module!.createInviteRevokeHandler(s.deps)(
      request({ promise_id: PROMISE_ID }),
    );

    expect(response.status).toBe(status);
    expect((await jsonOf(response))['code']).toBe(code);
  });
});
