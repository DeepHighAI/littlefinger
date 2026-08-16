import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const IDEMPOTENCY_KEY = '22222222-2222-4222-8222-222222222222';
const EXPO_TOKEN = 'ExponentPushToken[private-device-token]';

const PREFERENCES = {
  remind_d7: true,
  remind_d3: false,
  remind_d1: true,
  remind_dday: true,
  remind_hour: '12',
} as const;

const PROFILE = {
  nickname: '새끼손가락',
  profile_image_url: null,
  keep_rate: 67,
  completed_count: 2,
  broken_count: 1,
  disputed_count: 1,
  unresolved_count: 1,
  active_count: 3,
  updated_at: '2026-08-17T00:00:00Z',
  reminders: PREFERENCES,
} as const;

const SETTINGS = { reminders: PREFERENCES, updated_at: '2026-08-17T00:00:00Z' } as const;

interface HandlerModule {
  [name: string]: ((deps: Deps) => (request: Request) => Promise<Response>) | undefined;
}

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  logs: { message: string; detail: unknown }[];
}

async function load(path: string): Promise<HandlerModule | null> {
  return import(/* @vite-ignore */ path).catch(() => null) as Promise<HandlerModule | null>;
}

function spy(options: {
  payload?: unknown;
  authenticate?: (authorization: string | null) => Promise<string>;
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
} = {}): Spy {
  const rpcCalls: Spy['rpcCalls'] = [];
  const logs: Spy['logs'] = [];
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
      now: () => new Date('2026-08-17T00:00:00Z'),
    },
  };
}

function request(
  slug: string,
  body: unknown,
  options: { authorization?: boolean; idempotencyKey?: string; method?: string } = {},
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.authorization !== false) headers['authorization'] = 'Bearer jwt';
  if (options.idempotencyKey !== undefined) {
    headers['idempotency-key'] = options.idempotencyKey;
  }
  return new Request(`https://ref.supabase.co/functions/v1/${slug}`, {
    method: options.method ?? 'POST',
    headers,
    ...(options.method === 'GET' || options.method === 'OPTIONS'
      ? {}
      : { body: JSON.stringify(body) }),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('F-09 trust profile Edge Functions', () => {
  let profile: HandlerModule | null;
  let settings: HandlerModule | null;
  let unregister: HandlerModule | null;

  beforeEach(async () => {
    [profile, settings, unregister] = await Promise.all([
      load('../functions/trust-profile/handler.ts'),
      load('../functions/trust-profile-settings-update/handler.ts'),
      load('../functions/device-token-unregister/handler.ts'),
    ]);
  });

  test('Deno 전역 없는 세 순수 handler를 제공한다', () => {
    expect(profile?.['createTrustProfileHandler']).toBeTypeOf('function');
    expect(settings?.['createTrustProfileSettingsUpdateHandler']).toBeTypeOf('function');
    expect(unregister?.['createDeviceTokenUnregisterHandler']).toBeTypeOf('function');
  });

  test('프로필은 JWT actor와 빈 본문만 RPC에 전달한다', async () => {
    const s = spy({ payload: PROFILE });
    const response = await profile!.createTrustProfileHandler!(s.deps)(request('trust-profile', {}));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PROFILE);
    expect(s.rpcCalls).toEqual([{ fn: 'lf_my_trust_profile', args: { p_actor: ACTOR_ID } }]);
  });

  test('프로필 조회 본문은 빈 객체만 허용한다', async () => {
    const s = spy({ payload: PROFILE });
    const response = await profile!.createTrustProfileHandler!(s.deps)(
      request('trust-profile', { actor: ACTOR_ID }),
    );

    expect(response.status).toBe(422);
    expect((await jsonOf(response)).field).toBe('reminders');
    expect(s.rpcCalls).toEqual([]);
  });

  test('설정은 JWT actor·멱등 키·정확한 reminders만 RPC에 전달한다', async () => {
    const s = spy({ payload: SETTINGS });
    const response = await settings!.createTrustProfileSettingsUpdateHandler!(s.deps)(
      request('trust-profile-settings-update', { reminders: PREFERENCES }, { idempotencyKey: IDEMPOTENCY_KEY }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SETTINGS);
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_trust_profile_settings_update',
        args: {
          p_actor: ACTOR_ID,
          p_idempotency_key: IDEMPOTENCY_KEY,
          p_reminders: PREFERENCES,
        },
      },
    ]);
  });

  test('토큰 해제는 JWT actor·멱등 키·정확한 토큰만 RPC에 전달한다', async () => {
    const s = spy({ payload: { removed: true } });
    const response = await unregister!.createDeviceTokenUnregisterHandler!(s.deps)(
      request('device-token-unregister', { expo_push_token: EXPO_TOKEN }, { idempotencyKey: IDEMPOTENCY_KEY }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ removed: true });
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_device_token_unregister',
        args: {
          p_actor: ACTOR_ID,
          p_idempotency_key: IDEMPOTENCY_KEY,
          p_expo_push_token: EXPO_TOKEN,
        },
      },
    ]);
  });

  test.each([
    [{}, 'reminders'],
    [{ reminders: PREFERENCES, extra: true }, 'reminders'],
    [{ reminders: { ...PREFERENCES, remind_d7: 1 } }, 'reminders'],
    [{ reminders: { ...PREFERENCES, remind_hour: 12 } }, 'remind_hour'],
    [{ reminders: { ...PREFERENCES, remind_hour: '08' } }, 'remind_hour'],
    [{ reminders: { ...PREFERENCES, extra: true } }, 'reminders'],
  ] as const)('잘못된 설정 본문 %j는 %s 오류로 RPC 전에 막는다', async (body, field) => {
    const s = spy({ payload: SETTINGS });
    const response = await settings!.createTrustProfileSettingsUpdateHandler!(s.deps)(
      request('trust-profile-settings-update', body, { idempotencyKey: IDEMPOTENCY_KEY }),
    );

    expect(response.status).toBe(422);
    expect((await jsonOf(response)).field).toBe(field);
    expect(s.rpcCalls).toEqual([]);
  });

  test.each([
    [{}, 'expo_push_token'],
    [{ expo_push_token: 1 }, 'expo_push_token'],
    [{ expo_push_token: '' }, 'expo_push_token'],
    [{ expo_push_token: EXPO_TOKEN, extra: true }, 'expo_push_token'],
  ] as const)('잘못된 토큰 본문 %j는 %s 오류로 RPC 전에 막는다', async (body, field) => {
    const s = spy({ payload: { removed: false } });
    const response = await unregister!.createDeviceTokenUnregisterHandler!(s.deps)(
      request('device-token-unregister', body, { idempotencyKey: IDEMPOTENCY_KEY }),
    );

    expect(response.status).toBe(422);
    expect((await jsonOf(response)).field).toBe(field);
    expect(s.rpcCalls).toEqual([]);
  });

  test('mutation은 UUID 멱등 키 없이는 RPC에 닿지 않는다', async () => {
    const settingsSpy = spy({ payload: SETTINGS });
    const tokenSpy = spy({ payload: { removed: true } });

    for (const key of [undefined, 'not-a-uuid']) {
      const options = key === undefined ? {} : { idempotencyKey: key };
      const settingsResponse = await settings!.createTrustProfileSettingsUpdateHandler!(settingsSpy.deps)(
        request('trust-profile-settings-update', { reminders: PREFERENCES }, options),
      );
      const tokenResponse = await unregister!.createDeviceTokenUnregisterHandler!(tokenSpy.deps)(
        request('device-token-unregister', { expo_push_token: EXPO_TOKEN }, options),
      );
      expect(settingsResponse.status).toBe(422);
      expect((await jsonOf(settingsResponse)).field).toBe('idempotency_key');
      expect(tokenResponse.status).toBe(422);
      expect((await jsonOf(tokenResponse)).field).toBe('idempotency_key');
    }
    expect(settingsSpy.rpcCalls).toEqual([]);
    expect(tokenSpy.rpcCalls).toEqual([]);
  });

  test('JWT 실패는 body 파싱과 RPC보다 먼저 끝난다', async () => {
    const s = spy({ authenticate: async () => { throw new ApiError('E_AUTH_REQUIRED'); } });
    const response = await settings!.createTrustProfileSettingsUpdateHandler!(s.deps)(
      request('trust-profile-settings-update', null, { idempotencyKey: IDEMPOTENCY_KEY }),
    );

    expect(response.status).toBe(401);
    expect(s.rpcCalls).toEqual([]);
  });

  test('세 함수 모두 OPTIONS는 204이고 POST 외 method는 검증 오류다', async () => {
    const cases = [
      ['trust-profile', profile!.createTrustProfileHandler!, {}, {}],
      ['trust-profile-settings-update', settings!.createTrustProfileSettingsUpdateHandler!, { reminders: PREFERENCES }, { idempotencyKey: IDEMPOTENCY_KEY }],
      ['device-token-unregister', unregister!.createDeviceTokenUnregisterHandler!, { expo_push_token: EXPO_TOKEN }, { idempotencyKey: IDEMPOTENCY_KEY }],
    ] as const;
    for (const [slug, factory, body, headers] of cases) {
      const s = spy({ payload: PROFILE });
      const handler = factory(s.deps);
      expect((await handler(request(slug, body, { ...headers, method: 'OPTIONS' }))).status).toBe(204);
      expect((await handler(request(slug, body, { ...headers, method: 'GET' }))).status).toBe(422);
      expect(s.rpcCalls).toEqual([]);
    }
  });

  test.each([
    ['profile', () => profile!.createTrustProfileHandler!, 'trust-profile', {}, PROFILE],
    ['settings', () => settings!.createTrustProfileSettingsUpdateHandler!, 'trust-profile-settings-update', { reminders: PREFERENCES }, SETTINGS],
    ['unregister', () => unregister!.createDeviceTokenUnregisterHandler!, 'device-token-unregister', { expo_push_token: EXPO_TOKEN }, { removed: true }],
  ] as const)('%s RPC 공개 응답이 엄격 계약을 벗어나면 500으로 평탄화한다', async (_name, factory, slug, body, payload) => {
    const s = spy({ payload: { ...payload, private_path: '/private/value' } });
    const response = await factory()(s.deps)(
      request(slug, body, slug === 'trust-profile' ? {} : { idempotencyKey: IDEMPOTENCY_KEY }),
    );

    expect(response.status).toBe(500);
    expect(await jsonOf(response)).toMatchObject({ code: 'E_INTERNAL' });
    expect(s.logs).toEqual([{ message: 'unmapped RPC failure', detail: { reason: 'UNMAPPED_ERROR' } }]);
  });

  test('알려진 RPC 오류는 공통 코드로 유지한다', async () => {
    const s = spy({ rpc: async () => { throw new Error('E_FORBIDDEN'); } });
    const response = await profile!.createTrustProfileHandler!(s.deps)(request('trust-profile', {}));

    expect(response.status).toBe(403);
    expect(await jsonOf(response)).toMatchObject({ code: 'E_FORBIDDEN' });
  });

  test('오류 로그에는 토큰과 설정 원문을 남기지 않는다', async () => {
    const tokenSpy = spy({ rpc: async () => { throw new Error(`database leaked ${EXPO_TOKEN}`); } });
    const settingsSpy = spy({ rpc: async () => { throw new Error(`database leaked ${JSON.stringify(PREFERENCES)}`); } });
    await unregister!.createDeviceTokenUnregisterHandler!(tokenSpy.deps)(
      request('device-token-unregister', { expo_push_token: EXPO_TOKEN }, { idempotencyKey: IDEMPOTENCY_KEY }),
    );
    await settings!.createTrustProfileSettingsUpdateHandler!(settingsSpy.deps)(
      request('trust-profile-settings-update', { reminders: PREFERENCES }, { idempotencyKey: IDEMPOTENCY_KEY }),
    );
    const serialized = JSON.stringify([...tokenSpy.logs, ...settingsSpy.logs]);
    expect(serialized).not.toContain(EXPO_TOKEN);
    expect(serialized).not.toContain(JSON.stringify(PREFERENCES));
    expect(serialized).toContain('UNMAPPED_ERROR');
  });
});
