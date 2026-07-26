import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';
import type { NotificationRow } from '../functions/_shared/notify.ts';
import { createInviteResolveHandler } from '../functions/invite-resolve/handler.ts';
import { createAmendHandler } from '../functions/promise-amend/handler.ts';
import { createApproveHandler } from '../functions/promise-approve/handler.ts';
import { createDeclineHandler } from '../functions/promise-decline/handler.ts';

/**
 * 껍데기 네 개를 가짜 `Deps` 위에서 끝까지 돌린다.
 *
 * RPC 안쪽은 `promise-approve.test.ts` 와 `promise-decline-amend.test.ts` 가 PGlite 로 이미
 * 붙들고 있다. 여기서 보는 것은 **껍데기만 아는 것**이다 — 판정 순서, RPC 인자, 에러 매핑,
 * 그리고 커밋 뒤 알림.
 */

const PEPPER = 'pep-xyz';
const SALT = 'salt-abc';
const KEY = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const TOKEN = 'tok-abcdef';
const NOW = new Date('2026-07-27T00:30:00Z');

const PAYLOAD = {
  promise_id: 'p-1',
  creator_id: 'c-1',
  title: '매일 걷기',
  partner: { user_id: 'u-1', nickname: '민준', profile_image_url: null },
};

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  notifications: NotificationRow[];
  logs: string[];
}

function spy(
  overrides: {
    rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    authenticate?: (authorization: string | null) => Promise<string>;
    insertNotification?: (row: NotificationRow) => Promise<void>;
  } = {},
): Spy {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const notifications: NotificationRow[] = [];
  const logs: string[] = [];

  const deps: Deps = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      return overrides.rpc === undefined ? PAYLOAD : await overrides.rpc(fn, args);
    },
    authenticate:
      overrides.authenticate ??
      (async (authorization) => {
        if (authorization === null) throw new ApiError('E_AUTH_REQUIRED');
        return 'u-1';
      }),
    insertNotification:
      overrides.insertNotification ??
      (async (row) => {
        notifications.push(row);
      }),
    secrets: { invitePepper: PEPPER, piiSalt: SALT },
    log: { error: (message) => logs.push(message) },
    now: () => NOW,
  };

  return { deps, rpcCalls, notifications, logs };
}

function request(options: {
  headers?: Record<string, string>;
  body?: unknown;
  method?: string;
}): Request {
  return new Request('https://ref.supabase.co/functions/v1/x', {
    method: options.method ?? 'POST',
    headers: options.headers ?? {},
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

/** 상태 변경 요청의 정상 형태 */
function transitionRequest(body: Record<string, unknown> = { token: TOKEN }): Request {
  return request({
    headers: {
      authorization: 'Bearer jwt-value',
      'idempotency-key': KEY,
      'x-forwarded-for': '1.2.3.4, 10.0.0.1',
      'user-agent': 'KAKAOTALK/10',
      origin: 'https://littlefinger.pages.dev',
    },
    body,
  });
}

const expectedTokenHash = createHash('sha256').update(TOKEN + PEPPER, 'utf8').digest('hex');

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

const TRANSITIONS = [
  { name: 'promise-approve', create: createApproveHandler, rpc: 'lf_promise_approve', event: 'NT-01' },
  { name: 'promise-decline', create: createDeclineHandler, rpc: 'lf_promise_decline', event: 'NT-02' },
  {
    name: 'promise-amend',
    create: createAmendHandler,
    rpc: 'lf_promise_amend_suggest',
    event: 'NT-03',
  },
] as const;

/** 수정 제안만 본문에 필수 필드가 하나 더 있다. */
function bodyFor(name: string): Record<string, unknown> {
  return name === 'promise-amend' ? { token: TOKEN, comment: '종료일을 옮겨 주세요' } : { token: TOKEN };
}

describe('invite-resolve — 비로그인 경로 (§4-3-3)', () => {
  let s: Spy;
  beforeEach(() => {
    s = spy();
  });

  test('로그인 없이도 통과한다 — authenticate 를 아예 부르지 않는다', async () => {
    const response = await createInviteResolveHandler(s.deps)(request({ body: { token: TOKEN } }));
    expect(response.status).toBe(200);
  });

  test('원문 토큰이 아니라 해시를 RPC 에 넘긴다', async () => {
    await createInviteResolveHandler(s.deps)(request({ body: { token: TOKEN } }));

    expect(s.rpcCalls).toHaveLength(1);
    expect(s.rpcCalls[0]?.fn).toBe('lf_invite_resolve');
    expect(s.rpcCalls[0]?.args).toEqual({ p_token_hash: expectedTokenHash });
    // 원문이 인자에 남아 있으면 안 된다(§13 "DB·로그 어디에도").
    expect(JSON.stringify(s.rpcCalls[0]?.args)).not.toContain(TOKEN);
  });

  test('Idempotency-Key 를 요구하지 않는다 — 상태를 바꾸지 않기 때문이다', async () => {
    const response = await createInviteResolveHandler(s.deps)(request({ body: { token: TOKEN } }));
    expect(response.status).toBe(200);
  });

  test('알림을 만들지 않는다', async () => {
    await createInviteResolveHandler(s.deps)(request({ body: { token: TOKEN } }));
    expect(s.notifications).toHaveLength(0);
  });

  test.each(['E_NOT_FOUND', 'E_INVITE_EXPIRED', 'E_INVITE_USED', 'E_INVITE_REVOKED'])(
    '%s 는 payload 를 한 조각도 싣지 않는다 (EC-B01·B03)',
    async (code) => {
      const failing = spy({
        rpc: async () => {
          throw new Error(code);
        },
      });
      const response = await createInviteResolveHandler(failing.deps)(
        request({ body: { token: TOKEN } }),
      );

      const body = await jsonOf(response);
      expect(body['code']).toBe(code);
      // 작성자 이름도 제목도 없어야 한다 — 유출된 링크를 연 사람에게 존재를 알리지 않는다.
      expect(Object.keys(body).sort()).toEqual(['code', 'message']);
    },
  );

  test('토큰이 없으면 RPC 를 부르지 않는다', async () => {
    const response = await createInviteResolveHandler(s.deps)(request({ body: {} }));
    expect(response.status).toBe(422);
    expect(s.rpcCalls).toHaveLength(0);
  });

  test('OPTIONS 는 preflight 로 답한다', async () => {
    const response = await createInviteResolveHandler(s.deps)(request({ method: 'OPTIONS' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('idempotency-key');
  });
});

describe.each(TRANSITIONS)('$name — 상태 전이 껍데기', ({ name, create, rpc, event }) => {
  let s: Spy;
  beforeEach(() => {
    s = spy();
  });

  test('세션 확인이 가장 먼저다 — 인증 실패면 RPC 를 부르지 않는다', async () => {
    // 부르면 로그인하지 않은 사람이 응답 차이로 토큰의 유효성을 떠볼 수 있다(§9 검사 순서).
    const response = await create(s.deps)(request({ body: bodyFor(name) }));

    expect(response.status).toBe(401);
    expect(s.rpcCalls).toHaveLength(0);
  });

  test('Idempotency-Key 가 없으면 RPC 를 부르지 않는다 (§7-3.6)', async () => {
    const response = await create(s.deps)(
      request({ headers: { authorization: 'Bearer jwt' }, body: bodyFor(name) }),
    );

    expect(response.status).toBe(422);
    expect(await jsonOf(response).then((b) => b['field'])).toBe('idempotency_key');
    expect(s.rpcCalls).toHaveLength(0);
  });

  test(`${rpc} 를 부르고 공통 인자를 채운다`, async () => {
    await create(s.deps)(transitionRequest(bodyFor(name)));

    const call = s.rpcCalls[0];
    expect(call?.fn).toBe(rpc);
    expect(call?.args).toMatchObject({
      p_idempotency_key: KEY,
      p_token_hash: expectedTokenHash,
      p_user_id: 'u-1',
      // Origin 이 있으므로 WEB 이다.
      p_surface: 'WEB',
    });
    // IP·UA 는 해시로만 간다. 64자 hex 이고 원문과 다르다.
    expect(call?.args['p_ip_hash']).toMatch(/^[0-9a-f]{64}$/);
    expect(call?.args['p_ua_hash']).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(call?.args)).not.toContain('1.2.3.4');
    expect(JSON.stringify(call?.args)).not.toContain('KAKAOTALK');
  });

  test('IP·UA 헤더가 없으면 NULL 을 넘긴다', async () => {
    await create(s.deps)(
      request({
        headers: { authorization: 'Bearer jwt', 'idempotency-key': KEY },
        body: bodyFor(name),
      }),
    );

    expect(s.rpcCalls[0]?.args['p_ip_hash']).toBeNull();
    expect(s.rpcCalls[0]?.args['p_ua_hash']).toBeNull();
  });

  test('Origin 이 없으면 APP 으로 기록한다', async () => {
    await create(s.deps)(
      request({
        headers: { authorization: 'Bearer jwt', 'idempotency-key': KEY },
        body: bodyFor(name),
      }),
    );

    expect(s.rpcCalls[0]?.args['p_surface']).toBe('APP');
  });

  test(`성공하면 ${event} 알림 한 행을 작성자에게 남긴다`, async () => {
    const response = await create(s.deps)(transitionRequest(bodyFor(name)));

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual(PAYLOAD);
    expect(s.notifications).toHaveLength(1);
    expect(s.notifications[0]).toMatchObject({
      type: event,
      user_id: 'c-1',
      channel: 'INAPP',
      status: 'SENT',
      body: '매일 걷기',
    });
  });

  test('알림 삽입이 실패해도 응답은 200 이다 (EC-C02)', async () => {
    // 전이는 이미 커밋됐다. 여기서 실패로 답하면 확정된 약속에 사용자만 에러를 본다.
    const failing = spy({
      insertNotification: async () => {
        throw new Error('notifications insert failed');
      },
    });
    const response = await create(failing.deps)(transitionRequest(bodyFor(name)));

    expect(response.status).toBe(200);
    expect(failing.logs).toContain('notification insert failed');
  });

  test('payload 에 알림 재료가 없으면 로그만 남기고 응답은 그대로다', async () => {
    const thin = spy({ rpc: async () => ({ promise_id: 'p-1', status: 'ACTIVE' }) });
    const response = await create(thin.deps)(transitionRequest(bodyFor(name)));

    expect(response.status).toBe(200);
    expect(thin.notifications).toHaveLength(0);
    expect(thin.logs).toContain('RPC payload is missing notification fields');
  });

  test.each([
    ['E_INVITE_EXPIRED', 410],
    ['E_INVITE_USED', 410],
    ['E_INVITE_REVOKED', 410],
    ['E_SELF_INVITE', 422],
    ['E_DUPLICATE_ROLE', 422],
    ['E_BLOCKED', 422],
    ['E_STATE_CONFLICT', 409],
    ['E_FORBIDDEN', 403],
    ['E_NOT_FOUND', 404],
  ])('%s 를 %i 로 매핑한다', async (code, status) => {
    const failing = spy({
      rpc: async () => {
        throw new Error(code);
      },
    });
    const response = await create(failing.deps)(transitionRequest(bodyFor(name)));

    expect(response.status).toBe(status);
    expect(await jsonOf(response).then((b) => b['code'])).toBe(code);
    expect(failing.notifications).toHaveLength(0);
  });

  test('실패하면 알림을 만들지 않는다', async () => {
    const failing = spy({
      rpc: async () => {
        throw new Error('E_STATE_CONFLICT');
      },
    });
    await create(failing.deps)(transitionRequest(bodyFor(name)));
    expect(failing.notifications).toHaveLength(0);
  });
});

describe('함수별 E_VALIDATION 의 뜻', () => {
  test('승인 — 종료일 경과이고 EC-B10 의 출구를 함께 싣는다', async () => {
    const failing = spy({
      rpc: async () => {
        throw new Error('E_VALIDATION');
      },
    });
    const response = await createApproveHandler(failing.deps)(transitionRequest());

    expect(response.status).toBe(422);
    expect(await jsonOf(response)).toEqual({
      code: 'E_VALIDATION',
      message: '종료일이 지난 약속은 승인할 수 없어요. 작성자에게 종료일 변경을 요청해 주세요.',
      field: 'end_date',
      // 이 값이 없으면 SCR-W02 가 [종료일 변경 요청하기] 를 띄울 근거가 없고,
      // 종료일이 지난 약속은 PENDING 에 영구히 갇힌다.
      action: 'AMEND_SUGGEST',
    });
  });

  test('거절 — 사유 길이이고 §5-3 에 문구가 없어 공통 문구로 떨어진다', async () => {
    const failing = spy({
      rpc: async () => {
        throw new Error('E_VALIDATION');
      },
    });
    const body = await jsonOf(
      await createDeclineHandler(failing.deps)(transitionRequest({ token: TOKEN, reason: 'x' })),
    );

    expect(body['field']).toBe('decline_reason');
    expect(body['action']).toBeUndefined();
  });

  test('수정 제안 — §5-3 문구 원문을 싣는다', async () => {
    const failing = spy({
      rpc: async () => {
        throw new Error('E_VALIDATION');
      },
    });
    const body = await jsonOf(
      await createAmendHandler(failing.deps)(transitionRequest({ token: TOKEN, comment: 'x' })),
    );

    expect(body['field']).toBe('amend_suggestion');
    expect(body['message']).toBe('어떤 부분을 바꾸고 싶은지 알려주세요.');
  });
});

describe('본문 필드', () => {
  test('거절 사유는 선택이다 — 없으면 NULL 을 넘긴다 (§5-3)', async () => {
    const s = spy();
    await createDeclineHandler(s.deps)(transitionRequest({ token: TOKEN }));
    expect(s.rpcCalls[0]?.args['p_reason']).toBeNull();
  });

  test('거절 사유를 보내면 정규화하지 않고 그대로 넘긴다', async () => {
    // 정규화·길이 판정은 RPC 몫이다(§2-3). 껍데기가 먼저 손대면 두 곳이 어긋난다.
    const s = spy();
    await createDeclineHandler(s.deps)(transitionRequest({ token: TOKEN, reason: '  어려워요  ' }));
    expect(s.rpcCalls[0]?.args['p_reason']).toBe('  어려워요  ');
  });

  test('수정 제안 의견은 필수다 — 없으면 RPC 를 부르지 않는다', async () => {
    const s = spy();
    const response = await createAmendHandler(s.deps)(transitionRequest({ token: TOKEN }));

    expect(response.status).toBe(422);
    expect(await jsonOf(response).then((b) => b['field'])).toBe('amend_suggestion');
    expect(s.rpcCalls).toHaveLength(0);
  });

  test('승인은 본문에 토큰만 요구한다', async () => {
    const s = spy();
    await createApproveHandler(s.deps)(transitionRequest({ token: TOKEN }));

    expect(Object.keys(s.rpcCalls[0]?.args ?? {}).sort()).toEqual([
      'p_idempotency_key',
      'p_ip_hash',
      'p_surface',
      'p_token_hash',
      'p_ua_hash',
      'p_user_id',
    ]);
  });
});
