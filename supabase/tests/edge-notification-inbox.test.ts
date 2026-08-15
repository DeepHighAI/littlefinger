import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const PROMISE_ID = '33333333-3333-4333-8333-333333333333';
const KEY = '44444444-4444-4444-8444-444444444444';

const INBOX_HANDLER_PATH = '../functions/notification-inbox/handler.ts';
const READ_HANDLER_PATH = '../functions/notification-read/handler.ts';
const READ_ALL_HANDLER_PATH = '../functions/notification-read-all/handler.ts';

interface InboxHandlerModule {
  createNotificationInboxHandler: (deps: Deps) => (request: Request) => Promise<Response>;
}

interface ReadHandlerModule {
  createNotificationReadHandler: (deps: Deps) => (request: Request) => Promise<Response>;
}

interface ReadAllHandlerModule {
  createNotificationReadAllHandler: (deps: Deps) => (request: Request) => Promise<Response>;
}

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
}

async function loadHandlers(): Promise<{
  inbox: InboxHandlerModule | null;
  read: ReadHandlerModule | null;
  readAll: ReadAllHandlerModule | null;
}> {
  const [inbox, read, readAll] = await Promise.all([
    import(/* @vite-ignore */ INBOX_HANDLER_PATH).catch(() => null),
    import(/* @vite-ignore */ READ_HANDLER_PATH).catch(() => null),
    import(/* @vite-ignore */ READ_ALL_HANDLER_PATH).catch(() => null),
  ]);
  return {
    inbox: inbox as InboxHandlerModule | null,
    read: read as ReadHandlerModule | null,
    readAll: readAll as ReadAllHandlerModule | null,
  };
}

function spy(options: {
  payload?: unknown;
  authenticate?: (authorization: string | null) => Promise<string>;
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
} = {}): Spy {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    rpcCalls,
    deps: {
      authenticate:
        options.authenticate ??
        (async () => ACTOR_ID),
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return options.rpc === undefined ? options.payload : await options.rpc(fn, args);
      },
      secrets: { invitePepper: 'unused', piiSalt: 'unused' },
      log: { error: () => {} },
      now: () => new Date('2026-08-15T00:00:00.000Z'),
    },
  };
}

function request(options: {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
} = {}): Request {
  return new Request('https://ref.supabase.co/functions/v1/notification-inbox', {
    method: options.method ?? 'POST',
    headers: { authorization: 'Bearer jwt', ...options.headers },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('SCR-A07 notification inbox Edge Functions', () => {
  let handlers: Awaited<ReturnType<typeof loadHandlers>>;

  beforeEach(async () => {
    handlers = await loadHandlers();
  });

  test('세 공개 endpoint는 테스트 가능한 순수 handler를 제공한다', () => {
    expect(handlers.inbox?.createNotificationInboxHandler).toBeTypeOf('function');
    expect(handlers.read?.createNotificationReadHandler).toBeTypeOf('function');
    expect(handlers.readAll?.createNotificationReadAllHandler).toBeTypeOf('function');
  });

  test('목록은 JWT 사용자·cursor·limit만 RPC에 보내고 내부 알림 필드를 공개하지 않는다', async () => {
    const s = spy({
      payload: {
        items: [
          {
            notification_id: NOTIFICATION_ID,
            promise_id: PROMISE_ID,
            event: 'NT-01',
            title: '손가락 걸었어요!',
            body: '매일 걷기',
            deeplink: 'https://evil.example',
            created_at: '2026-08-14T00:00:00.000Z',
            read_at: null,
            dedupe_key: 'private-key',
            fail_reason: 'private failure',
            channel: 'INAPP',
          },
        ],
        unread_count: 1,
        next_cursor: { created_at: '2026-08-14T00:00:00.000Z', notification_id: NOTIFICATION_ID },
      },
    });

    const response = await handlers.inbox!.createNotificationInboxHandler(s.deps)(
      request({
        body: {
          cursor: { created_at: '2026-08-14T01:00:00.000Z', notification_id: NOTIFICATION_ID },
          limit: 30,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          notification_id: NOTIFICATION_ID,
          promise_id: PROMISE_ID,
          event: 'NT-01',
          title: '손가락 걸었어요!',
          body: '매일 걷기',
          deeplink: 'SCR-A05',
          created_at: '2026-08-14T00:00:00.000Z',
          read_at: null,
        },
      ],
      unread_count: 1,
      next_cursor: { created_at: '2026-08-14T00:00:00.000Z', notification_id: NOTIFICATION_ID },
    });
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_notification_inbox_list',
        args: {
          p_actor: ACTOR_ID,
          p_cursor_created_at: '2026-08-14T01:00:00.000Z',
          p_cursor_notification_id: NOTIFICATION_ID,
          p_limit: 30,
        },
      },
    ]);
  });

  test('목록은 Idempotency-Key 없이도 읽기 전용 RPC를 호출한다', async () => {
    const s = spy({ payload: { items: [], unread_count: 0, next_cursor: null } });

    const response = await handlers.inbox!.createNotificationInboxHandler(s.deps)(
      request({ body: {} }),
    );

    expect(response.status).toBe(200);
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_notification_inbox_list',
        args: {
          p_actor: ACTOR_ID,
          p_cursor_created_at: null,
          p_cursor_notification_id: null,
          p_limit: null,
        },
      },
    ]);
  });

  test.each([
    [{ cursor: { created_at: 'bad', notification_id: NOTIFICATION_ID } }, 'cursor'],
    [{ cursor: { created_at: '2026-08-14T00:00:00Z', notification_id: 'bad' } }, 'cursor'],
    [{ limit: 1.5 }, 'limit'],
    [{ limit: '20' }, 'limit'],
  ] as const)('잘못된 목록 형태 %j는 %s 오류로 RPC 전에 막는다', async (body, field) => {
    const s = spy({ payload: { items: [], unread_count: 0, next_cursor: null } });
    const response = await handlers.inbox!.createNotificationInboxHandler(s.deps)(request({ body }));

    expect(response.status).toBe(422);
    expect((await jsonOf(response)).field).toBe(field);
    expect(s.rpcCalls).toEqual([]);
  });

  test('단건 읽음은 UUID 멱등 키와 notification_id를 검증한 뒤 actor 전용 RPC를 부른다', async () => {
    const s = spy({
      payload: { notification_id: NOTIFICATION_ID, read_at: '2026-08-15T00:00:00.000Z' },
    });
    const response = await handlers.read!.createNotificationReadHandler(s.deps)(
      request({
        body: { notification_id: NOTIFICATION_ID },
        headers: { 'idempotency-key': KEY },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      notification_id: NOTIFICATION_ID,
      read_at: '2026-08-15T00:00:00.000Z',
    });
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_notification_read',
        args: { p_actor: ACTOR_ID, p_notification_id: NOTIFICATION_ID },
      },
    ]);
  });

  test('단건 읽음은 멱등 키 또는 notification_id가 잘못되면 RPC를 호출하지 않는다', async () => {
    for (const input of [
      request({ body: { notification_id: NOTIFICATION_ID } }),
      request({ body: { notification_id: NOTIFICATION_ID }, headers: { 'idempotency-key': 'bad' } }),
      request({ body: { notification_id: 'bad' }, headers: { 'idempotency-key': KEY } }),
    ]) {
      const s = spy();
      const response = await handlers.read!.createNotificationReadHandler(s.deps)(input);
      expect(response.status).toBe(422);
      expect(s.rpcCalls).toEqual([]);
    }
  });

  test('모두 읽음은 UUID 멱등 키를 요구하고 읽음 수만 응답한다', async () => {
    const s = spy({ payload: { read_count: 3, internal_ids: [NOTIFICATION_ID] } });
    const response = await handlers.readAll!.createNotificationReadAllHandler(s.deps)(
      request({ body: {}, headers: { 'idempotency-key': KEY } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ read_count: 3 });
    expect(s.rpcCalls).toEqual([{ fn: 'lf_notification_read_all', args: { p_actor: ACTOR_ID } }]);
  });

  test('JWT 확인은 형태와 RPC보다 먼저이며 타인 알림은 E_NOT_FOUND로 숨긴다', async () => {
    const unauthenticated = spy({
      authenticate: async () => {
        throw new ApiError('E_AUTH_REQUIRED');
      },
    });
    const authResponse = await handlers.read!.createNotificationReadHandler(unauthenticated.deps)(
      request({ body: { notification_id: 'bad' } }),
    );
    expect(authResponse.status).toBe(401);
    expect(unauthenticated.rpcCalls).toEqual([]);

    const hidden = spy({ rpc: async () => Promise.reject(new Error('E_NOT_FOUND')) });
    const hiddenResponse = await handlers.read!.createNotificationReadHandler(hidden.deps)(
      request({ body: { notification_id: NOTIFICATION_ID }, headers: { 'idempotency-key': KEY } }),
    );
    expect(hiddenResponse.status).toBe(404);
    expect((await jsonOf(hiddenResponse)).code).toBe('E_NOT_FOUND');
  });

  test('잘못된 RPC 응답과 알 수 없는 DB 오류는 내부 정보를 내보내지 않고 500으로 평탄화한다', async () => {
    const malformed = spy({
      payload: { items: [{ event: 'PRIVATE' }], unread_count: 1, next_cursor: null },
    });
    const malformedResponse = await handlers.inbox!.createNotificationInboxHandler(malformed.deps)(
      request({ body: {} }),
    );
    expect(malformedResponse.status).toBe(500);
    expect(await malformedResponse.text()).toBe(
      '{"code":"E_INTERNAL","message":"처리 중 문제가 발생했습니다. 다시 시도해 주세요."}',
    );

    const unknown = spy({ rpc: async () => Promise.reject(new Error('private table detail')) });
    const unknownResponse = await handlers.readAll!.createNotificationReadAllHandler(unknown.deps)(
      request({ body: {}, headers: { 'idempotency-key': KEY } }),
    );
    expect(unknownResponse.status).toBe(500);
    expect(await unknownResponse.text()).toBe(
      '{"code":"E_INTERNAL","message":"처리 중 문제가 발생했습니다. 다시 시도해 주세요."}',
    );
  });
});
