import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';
import { createUserProvisionHandler } from '../functions/user-provision/handler.ts';

/**
 * user-provision 껍데기 — 로그인 뒤 `public.users` 행 보정(핸드오프 2026-07-30).
 *
 * RPC 안쪽(`lf_user_provision`)은 `user-provisioning.test.ts` 가 PGlite 로 이미 붙들고
 * 있다. 여기서 보는 것은 **껍데기만 아는 것**이다 — surface 판정, RPC 인자, 에러 매핑,
 * 그리고 이 함수에 **없어야 하는 것**(알림, Idempotency-Key 요구).
 */

const NOW = new Date('2026-07-30T00:30:00Z');
const USER_ID = 'a3bb6a17-6b7e-4bbf-9f0e-2f4c1d1a9e01';

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  logs: string[];
}

function spy(
  overrides: {
    rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    authenticate?: (authorization: string | null) => Promise<string>;
  } = {},
): Spy {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const logs: string[] = [];

  const deps: Deps = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      // lf_user_provision 은 returns void 다 — 성공 시 payload 가 없다.
      return overrides.rpc === undefined ? null : await overrides.rpc(fn, args);
    },
    authenticate:
      overrides.authenticate ??
      (async (authorization) => {
        if (authorization === null) throw new ApiError('E_AUTH_REQUIRED');
        return USER_ID;
      }),
    secrets: { invitePepper: 'pep-xyz', piiSalt: 'salt-abc' },
    log: { error: (message) => logs.push(message) },
    now: () => NOW,
  };

  return { deps, rpcCalls, logs };
}

function request(options: {
  headers?: Record<string, string>;
  body?: unknown;
  method?: string;
}): Request {
  return new Request('https://ref.supabase.co/functions/v1/user-provision', {
    method: options.method ?? 'POST',
    headers: options.headers ?? { authorization: 'Bearer jwt-value' },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('user-provision — 로그인 뒤 보정 호출', () => {
  let s: Spy;
  beforeEach(() => {
    s = spy();
  });

  test('OPTIONS 는 preflight 로 답한다 — 수락 웹은 언제나 교차 출처다', async () => {
    const response = await createUserProvisionHandler(s.deps)(request({ method: 'OPTIONS' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(s.rpcCalls).toEqual([]);
  });

  test('POST 가 아니면 E_VALIDATION 이다', async () => {
    const response = await createUserProvisionHandler(s.deps)(request({ method: 'GET' }));
    expect(response.status).toBe(422);
    expect((await jsonOf(response)).code).toBe('E_VALIDATION');
    expect(s.rpcCalls).toEqual([]);
  });

  test('인증 없이는 401 이고 RPC 에 닿지 않는다', async () => {
    const response = await createUserProvisionHandler(s.deps)(
      request({ headers: {}, body: {} }),
    );
    expect(response.status).toBe(401);
    expect((await jsonOf(response)).code).toBe('E_AUTH_REQUIRED');
    expect(s.rpcCalls).toEqual([]);
  });

  test('성공 — JWT 의 사용자로 RPC 를 부르고 204 빈 응답을 돌려준다', async () => {
    const response = await createUserProvisionHandler(s.deps)(
      request({
        headers: {
          authorization: 'Bearer jwt-value',
          origin: 'https://littlefinger-app-philwoo.web.app',
        },
        body: { nickname: '지우', profile_image_url: 'https://k.kakaocdn.net/p.jpg' },
      }),
    );

    // returns void 인 RPC 의 정직한 매핑은 204 다 — 실을 payload 가 없다(api.ts 봉투 원칙).
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    // 브라우저가 응답을 읽으려면 실제 응답에도 CORS 헤더가 있어야 한다.
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');

    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_user_provision',
        args: {
          p_user_id: USER_ID,
          p_surface: 'WEB',
          p_nickname: '지우',
          p_profile_image_url: 'https://k.kakaocdn.net/p.jpg',
        },
      },
    ]);
  });

  test('Origin 이 없으면 APP 이다 — approvals.surface 와 같은 규칙', async () => {
    await createUserProvisionHandler(s.deps)(
      request({ body: { nickname: '지우' } }),
    );
    expect(s.rpcCalls[0]?.args['p_surface']).toBe('APP');
  });

  test('nickname·profile_image_url 은 선택이다 — 없으면 NULL 로 넘긴다', async () => {
    // 카카오 profile_nickname 은 [선택 동의]다(§6-1). 거부하면 metadata 에 키가 아예 없고,
    // 그때 RPC 가 대진값을 유지한다. 빈 문자열로 바꿔치기하지 않는다.
    await createUserProvisionHandler(s.deps)(request({ body: {} }));
    expect(s.rpcCalls[0]?.args['p_nickname']).toBeNull();
    expect(s.rpcCalls[0]?.args['p_profile_image_url']).toBeNull();
  });

  test('Idempotency-Key 를 요구하지 않는다 — RPC 자체가 멱등이다(먼저 쓴 값이 이긴다)', async () => {
    // 캐시가 오히려 해롭다: 다음 로그인은 다른 표면에서 올 수 있는데, 키를 재사용하면
    // 첫 로그인의 응답에 영구히 고정된다. 그래서 p_idempotency_key 인자 자체가 없다.
    const response = await createUserProvisionHandler(s.deps)(request({ body: {} }));
    expect(response.status).toBe(204);
    expect(Object.keys(s.rpcCalls[0]?.args ?? {})).not.toContain('p_idempotency_key');
  });

  test('본문이 JSON 이 아니면 E_VALIDATION 이다', async () => {
    const raw = new Request('https://ref.supabase.co/functions/v1/user-provision', {
      method: 'POST',
      headers: { authorization: 'Bearer jwt-value' },
      body: 'not-json',
    });
    const response = await createUserProvisionHandler(s.deps)(raw);
    expect(response.status).toBe(422);
    expect(s.rpcCalls).toEqual([]);
  });

  test('nickname 이 문자열이 아니면 E_VALIDATION 이고 필드를 가리킨다', async () => {
    const response = await createUserProvisionHandler(s.deps)(
      request({ body: { nickname: 42 } }),
    );
    expect(response.status).toBe(422);
    const body = await jsonOf(response);
    expect(body.code).toBe('E_VALIDATION');
    expect(body.field).toBe('nickname');
    expect(s.rpcCalls).toEqual([]);
  });

  test('profile_image_url 이 문자열이 아니면 자기 필드를 가리킨다', async () => {
    const response = await createUserProvisionHandler(s.deps)(
      request({ body: { profile_image_url: 42 } }),
    );
    expect(response.status).toBe(422);
    expect((await jsonOf(response)).field).toBe('profile_image_url');
  });

  test('RPC 가 raise 한 E_AUTH_REQUIRED 는 401 로 매핑된다', async () => {
    const failing = spy({
      rpc: async () => {
        throw new Error('E_AUTH_REQUIRED');
      },
    });
    const response = await createUserProvisionHandler(failing.deps)(request({ body: {} }));
    expect(response.status).toBe(401);
    expect((await jsonOf(response)).code).toBe('E_AUTH_REQUIRED');
  });

  test('모르는 실패는 500 으로 뭉개고 원문은 로그로만 남긴다', async () => {
    const failing = spy({
      rpc: async () => {
        throw new Error('duplicate key value violates unique constraint "users_provider_identity_key"');
      },
    });
    const response = await createUserProvisionHandler(failing.deps)(request({ body: {} }));
    expect(response.status).toBe(500);
    const body = await jsonOf(response);
    expect(body.code).toBe('E_INTERNAL');
    // Postgres 가 붙인 테이블·컬럼 이름이 응답으로 새면 안 된다(§9 실패 경로).
    expect(JSON.stringify(body)).not.toContain('users_provider_identity_key');
    expect(failing.logs).toEqual(['unmapped RPC failure']);
  });

  test('알림을 만들지 않는다 — §8-1 에 가입 NT-* 이벤트가 없다', async () => {
    await createUserProvisionHandler(s.deps)(request({ body: { nickname: '지우' } }));
    expect(s.rpcCalls.map((call) => call.fn)).toEqual(['lf_user_provision']);
  });
});
