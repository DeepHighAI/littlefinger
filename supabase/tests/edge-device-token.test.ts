import { beforeEach, describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { ApiError } from '../functions/_shared/errors.ts';

const USER_ID = 'a3bb6a17-6b7e-4bbf-9f0e-2f4c1d1a9e01';
const TOKEN = 'ExponentPushToken[device-token]';
const HANDLER_PATH = '../functions/device-token-register/handler.ts';

interface HandlerModule {
  createDeviceTokenRegisterHandler: (deps: Deps) => (request: Request) => Promise<Response>;
}

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
}

async function loadHandler(): Promise<HandlerModule | null> {
  return import(/* @vite-ignore */ HANDLER_PATH).catch(() => null) as Promise<HandlerModule | null>;
}

function spy(
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> = async () => null,
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
      secrets: { invitePepper: 'pepper', piiSalt: 'salt' },
      log: { error: () => {} },
      now: () => new Date('2026-07-30T00:00:00Z'),
    },
  };
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://ref.supabase.co/functions/v1/device-token-register', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt', ...headers },
    body: JSON.stringify(body),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('device-token-register Edge Function', () => {
  let module: HandlerModule | null;

  beforeEach(async () => {
    module = await loadHandler();
  });

  test('Expo 토큰을 JWT 사용자로 등록하고 204를 반환한다', async () => {
    expect(module?.createDeviceTokenRegisterHandler).toBeTypeOf('function');
    const s = spy();

    const response = await module!.createDeviceTokenRegisterHandler(s.deps)(
      request({ expo_push_token: TOKEN }),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(s.rpcCalls).toEqual([
      {
        fn: 'lf_device_token_register',
        args: { p_user_id: USER_ID, p_expo_push_token: TOKEN },
      },
    ]);
  });

  test('토큰이 없거나 문자열이 아니면 expo_push_token 필드 오류다', async () => {
    expect(module?.createDeviceTokenRegisterHandler).toBeTypeOf('function');
    const s = spy();

    for (const body of [{}, { expo_push_token: 42 }, { expo_push_token: '' }]) {
      const response = await module!.createDeviceTokenRegisterHandler(s.deps)(request(body));
      expect(response.status).toBe(422);
      expect((await jsonOf(response)).field).toBe('expo_push_token');
    }
    expect(s.rpcCalls).toEqual([]);
  });

  test('인증이 없으면 401이고 RPC에 닿지 않는다', async () => {
    expect(module?.createDeviceTokenRegisterHandler).toBeTypeOf('function');
    const s = spy();
    const raw = new Request('https://ref.supabase.co/functions/v1/device-token-register', {
      method: 'POST',
      body: JSON.stringify({ expo_push_token: TOKEN }),
    });

    const response = await module!.createDeviceTokenRegisterHandler(s.deps)(raw);

    expect(response.status).toBe(401);
    expect(s.rpcCalls).toEqual([]);
  });

  test('RPC의 비활성 사용자 거부는 403으로 매핑한다', async () => {
    expect(module?.createDeviceTokenRegisterHandler).toBeTypeOf('function');
    const s = spy(async () => {
      throw new Error('E_FORBIDDEN');
    });

    const response = await module!.createDeviceTokenRegisterHandler(s.deps)(
      request({ expo_push_token: TOKEN }),
    );

    expect(response.status).toBe(403);
    expect((await jsonOf(response)).code).toBe('E_FORBIDDEN');
  });
});
