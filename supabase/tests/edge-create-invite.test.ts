import { createHash } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';
import { createPromiseCreateHandler } from '../functions/promise-create/handler.ts';
import { createPromiseInviteHandler } from '../functions/promise-invite/handler.ts';

/**
 * 작성·초대 발송 껍데기 — 02 §4-2-2 · §4-3-1 (T-01 · T-02).
 *
 * RPC 안쪽은 `promise-create-invite.test.ts` 가 PGlite 로 붙들고 있다. 여기서 보는 것은
 * **껍데기만 아는 것**이다 — §5-1 필드 판정, 토큰 생성, 원문이 RPC 로 새지 않는다는 것,
 * 그리고 멱등 재시도에 토큰을 싣지 않는다는 것.
 */

const PEPPER = 'pep-xyz';
const SALT = 'salt-abc';
const KEY = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const PROMISE_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3302';
/** KST 2026-07-27 09:30. KST 기준 "내일"은 07-28 이다. */
const NOW = new Date('2026-07-27T00:30:00Z');

const CREATE_BODY = {
  title: '매일 걷기',
  body: '매일 30분 걷기로 했다',
  category: 'HABIT',
  end_date: '2026-08-10',
};

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
}

function spy(rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>): Spy {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

  const deps: Deps = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      if (rpc !== undefined) return await rpc(fn, args);
      // 정상 경로의 RPC 는 자기가 저장한 해시를 그대로 돌려준다.
      return {
        promise_id: 'p-9',
        status: args['p_token_hash'] === null ? 'DRAFT' : 'PENDING',
        invitation_id: 'i-9',
        expires_at: '2026-07-30T00:30:00Z',
        resend_count: 0,
        title: '매일 걷기',
        token_hash: args['p_token_hash'],
      };
    },
    authenticate: async (authorization) => {
      if (authorization === null) throw new ApiError('E_AUTH_REQUIRED');
      return 'u-1';
    },
    secrets: { invitePepper: PEPPER, piiSalt: SALT },
    log: { error: () => {} },
    now: () => NOW,
  };

  return { deps, rpcCalls };
}

function request(body: unknown, headers?: Record<string, string>): Request {
  return new Request('https://ref.supabase.co/functions/v1/x', {
    method: 'POST',
    headers: headers ?? { authorization: 'Bearer jwt-value', 'idempotency-key': KEY },
    body: JSON.stringify(body),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('promise-create — T-01 (§4-2-2)', () => {
  test('send 를 생략하면 DRAFT 만 만들고 토큰을 발급하지 않는다', async () => {
    const s = spy();
    const response = await createPromiseCreateHandler(s.deps)(request(CREATE_BODY));
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect(s.rpcCalls[0]?.fn).toBe('lf_promise_create');
    // 아무도 받지 않을 링크를 만들면 그 초대의 만료 알림이 작성자에게 나간다.
    expect(s.rpcCalls[0]?.args['p_token_hash']).toBeNull();
    expect(body['token']).toBeUndefined();
    expect(body['status']).toBe('DRAFT');
  });

  test('send 가 true 면 토큰을 만들어 해시만 넘기고 원문은 응답에만 싣는다', async () => {
    const s = spy();
    const body = await jsonOf(
      await createPromiseCreateHandler(s.deps)(request({ ...CREATE_BODY, send: true })),
    );
    const token = String(body['token']);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // 원문이 RPC 인자에 남으면 §13 "DB·로그 어디에도"가 깨진다.
    expect(JSON.stringify(s.rpcCalls[0]?.args)).not.toContain(token);
    expect(s.rpcCalls[0]?.args['p_token_hash']).toBe(
      createHash('sha256')
        .update(token + PEPPER, 'utf8')
        .digest('hex'),
    );
    // 서버 장부는 클라이언트로 내보내지 않는다.
    expect(body['token_hash']).toBeUndefined();
    expect(body['status']).toBe('PENDING');
  });

  test('멱등 재시도로 다른 해시가 돌아오면 토큰을 싣지 않는다', async () => {
    // 여기서 방금 만든 토큰을 실으면 **DB 에 없는 토큰**으로 링크가 조립되고,
    // 증상은 E_NOT_FOUND 하나뿐이라 추적할 단서가 남지 않는다.
    const s = spy(async () => ({
      promise_id: 'p-9',
      status: 'PENDING',
      token_hash: 'f'.repeat(64),
    }));
    const body = await jsonOf(
      await createPromiseCreateHandler(s.deps)(request({ ...CREATE_BODY, send: true })),
    );

    expect(body['token']).toBeUndefined();
    expect(body['token_hash']).toBeUndefined();
    expect(body['promise_id']).toBe('p-9');
  });

  test('정규화하지 않고 원문을 넘긴다 — 저장 값을 정하는 곳은 RPC 하나다', async () => {
    const s = spy();
    await createPromiseCreateHandler(s.deps)(request({ ...CREATE_BODY, title: '  매일 걷기  ' }));
    expect(s.rpcCalls[0]?.args['p_title']).toBe('  매일 걷기  ');
  });

  test('지킬 사람을 비우면 NULL 을 넘긴다 — 기본값은 RPC 가 정한다', async () => {
    const s = spy();
    await createPromiseCreateHandler(s.deps)(request(CREATE_BODY));
    expect(s.rpcCalls[0]?.args['p_keeper']).toBeNull();
  });

  test.each([
    ['title', { title: '가' }, '제목을 2자 이상 입력해 주세요.'],
    ['body', { body: '네글자다' }, '어떤 약속인지 5자 이상 적어주세요.'],
    ['end_date', { end_date: '2020-01-01' }, '종료일은 내일부터 1년 안으로 정해주세요.'],
  ])('%s 위반은 필드와 §5 문구를 함께 돌려준다', async (field, override, message) => {
    const s = spy();
    const response = await createPromiseCreateHandler(s.deps)(
      request({ ...CREATE_BODY, ...override }),
    );
    const body = await jsonOf(response);

    expect(response.status).toBe(422);
    expect(body['field']).toBe(field);
    expect(body['message']).toBe(message);
    // 판정을 통과하지 못하면 RPC 도 토큰도 없다.
    expect(s.rpcCalls).toHaveLength(0);
  });

  test.each([
    ['category', { category: 'MARRIAGE' }],
    ['keeper', { keeper: 'WITNESS' }],
    ['title', { title: '두\n줄' }],
    ['reward', { reward: '가'.repeat(101) }],
    ['penalty', { penalty: '가'.repeat(101) }],
  ])('%s 는 §5 에 문구가 없어 필드만 돌려준다', async (field, override) => {
    const s = spy();
    const response = await createPromiseCreateHandler(s.deps)(
      request({ ...CREATE_BODY, ...override }),
    );
    expect(response.status).toBe(422);
    expect(await jsonOf(response).then((b) => b['field'])).toBe(field);
  });

  test('기기 시계가 아니라 deps.now() 로 종료일 경계를 판정한다', async () => {
    // §2-2 — 날짜 경계는 서버가 KST 로 판단한다.
    expect(
      (await createPromiseCreateHandler(spy().deps)(request({ ...CREATE_BODY, end_date: '2026-07-27' })))
        .status,
    ).toBe(422);
    expect(
      (await createPromiseCreateHandler(spy().deps)(request({ ...CREATE_BODY, end_date: '2026-07-28' })))
        .status,
    ).toBe(200);
  });

  test('알림을 만들지 않는다 (§8-1 "초대 발송 자체는 시스템 알림이 아니다")', async () => {
    const s = spy();
    await createPromiseCreateHandler(s.deps)(request({ ...CREATE_BODY, send: true }));
    expect(s.rpcCalls.map((call) => call.fn)).toEqual(['lf_promise_create']);
  });

  test('로그인하지 않으면 401 이고 RPC 를 부르지 않는다', async () => {
    const s = spy();
    const response = await createPromiseCreateHandler(s.deps)(request(CREATE_BODY, {}));
    expect(response.status).toBe(401);
    expect(s.rpcCalls).toHaveLength(0);
  });

  test('Idempotency-Key 가 없으면 422 다 (§7-3.6)', async () => {
    const s = spy();
    const response = await createPromiseCreateHandler(s.deps)(
      request(CREATE_BODY, { authorization: 'Bearer jwt-value' }),
    );

    expect(response.status).toBe(422);
    expect(await jsonOf(response).then((b) => b['field'])).toBe('idempotency_key');
    expect(s.rpcCalls).toHaveLength(0);
  });

  test('OPTIONS 는 preflight 다 — idempotency-key 가 허용 헤더에 있어야 한다', async () => {
    const response = await createPromiseCreateHandler(spy().deps)(
      new Request('https://ref.supabase.co/functions/v1/x', { method: 'OPTIONS' }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('idempotency-key');
  });
});

describe('promise-invite — T-02 (§4-3-1)', () => {
  test('언제나 새 토큰을 발급하고 해시만 넘긴다', async () => {
    const s = spy();
    const body = await jsonOf(
      await createPromiseInviteHandler(s.deps)(request({ promise_id: PROMISE_ID })),
    );

    expect(s.rpcCalls[0]?.fn).toBe('lf_promise_invite');
    expect(Object.keys(s.rpcCalls[0]?.args ?? {}).sort()).toEqual([
      'p_idempotency_key',
      'p_promise_id',
      'p_token_hash',
      'p_user_id',
    ]);
    expect(String(body['token'])).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body['token_hash']).toBeUndefined();
    expect(body['expires_at']).toBe('2026-07-30T00:30:00Z');
  });

  test('promise_id 가 UUID 가 아니면 RPC 를 부르지 않는다', async () => {
    // 캐스팅이 22P02 로 터지면 Postgres 메시지가 그대로 응답에 실린다.
    const s = spy();
    const response = await createPromiseInviteHandler(s.deps)(request({ promise_id: 'not-a-uuid' }));

    expect(response.status).toBe(422);
    expect(await jsonOf(response).then((b) => b['field'])).toBe('promise_id');
    expect(s.rpcCalls).toHaveLength(0);
  });

  test('RPC 의 E_VALIDATION 은 종료일 하나뿐이다 (§7-1 T-02 선행 조건)', async () => {
    const s = spy(async () => {
      throw new Error('E_VALIDATION');
    });
    const response = await createPromiseInviteHandler(s.deps)(request({ promise_id: PROMISE_ID }));
    const body = await jsonOf(response);

    expect(response.status).toBe(422);
    expect(body['field']).toBe('end_date');
    expect(body['message']).toBe('종료일은 내일부터 1년 안으로 정해주세요.');
  });

  test.each([
    ['E_NOT_FOUND', 404],
    ['E_STATE_CONFLICT', 409],
    ['E_RATE_LIMIT', 429],
    ['E_FORBIDDEN', 403],
  ])('%s 는 %i 로 나간다 (§2-3)', async (code, status) => {
    const s = spy(async () => {
      throw new Error(code);
    });
    const response = await createPromiseInviteHandler(s.deps)(request({ promise_id: PROMISE_ID }));

    expect(response.status).toBe(status);
    // 종료일 설명은 E_VALIDATION 에만 붙는다. 가리지 않고 덮으면 만료된 약속에
    // 고칠 수 없는 것을 고치라고 말하게 된다.
    expect(await jsonOf(response).then((b) => b['field'])).toBeUndefined();
  });

  test('모르는 실패는 500 으로 뭉갠다 — Postgres 메시지가 새지 않는다', async () => {
    const s = spy(async () => {
      throw new Error('duplicate key value violates unique constraint "invitations_token_hash_key"');
    });
    const response = await createPromiseInviteHandler(s.deps)(request({ promise_id: PROMISE_ID }));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await jsonOf(response))).not.toContain('invitations');
  });

  test('알림을 만들지 않는다', async () => {
    const s = spy();
    await createPromiseInviteHandler(s.deps)(request({ promise_id: PROMISE_ID }));
    expect(s.rpcCalls.map((call) => call.fn)).toEqual(['lf_promise_invite']);
  });
});
