import {
  registerAndroidPushToken,
  type PushRegistrationDeps,
} from './push-registration.ts';

const ACCESS_TOKEN = 'session-access-token';
const PROJECT_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const EXPO_TOKEN = 'ExponentPushToken[device-token]';

function deps(
  overrides: Partial<PushRegistrationDeps> = {},
): PushRegistrationDeps & {
  calls: string[];
  fetch: PushRegistrationDeps['fetch'];
} {
  const calls: string[] = [];
  const fetch = jest.fn().mockImplementation(async () => {
    calls.push('register');
    return { ok: true, status: 204 };
  });

  return {
    calls,
    fetch,
    functionUrl: 'https://project.supabase.co/functions/v1/device-token-register',
    getExpoPushToken: jest.fn().mockImplementation(async () => {
      calls.push('token');
      return EXPO_TOKEN;
    }),
    getPermission: jest.fn().mockImplementation(async () => {
      calls.push('permission:get');
      return 'undetermined';
    }),
    platform: 'android',
    projectId: PROJECT_ID,
    requestPermission: jest.fn().mockImplementation(async () => {
      calls.push('permission:request');
      return 'granted';
    }),
    setAndroidChannel: jest.fn().mockImplementation(async () => {
      calls.push('channel');
    }),
    ...overrides,
  };
}

describe('Android Expo 푸시 토큰 등록', () => {
  test('채널 → 권한 → EAS projectId 토큰 → 서버 등록 순서다', async () => {
    const d = deps();

    await expect(registerAndroidPushToken(ACCESS_TOKEN, d)).resolves.toBe('REGISTERED');

    expect(d.calls).toEqual([
      'channel',
      'permission:get',
      'permission:request',
      'token',
      'register',
    ]);
    expect(d.getExpoPushToken).toHaveBeenCalledWith(PROJECT_ID);
    expect(d.fetch).toHaveBeenCalledWith(d.functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expo_push_token: EXPO_TOKEN }),
    });
  });

  test('이미 권한이 있으면 다시 묻지 않는다', async () => {
    const d = deps({
      getPermission: jest.fn().mockImplementation(async () => {
        d.calls.push('permission:get');
        return 'granted';
      }),
    });

    await registerAndroidPushToken(ACCESS_TOKEN, d);

    expect(d.requestPermission).not.toHaveBeenCalled();
    expect(d.calls).toEqual(['channel', 'permission:get', 'token', 'register']);
  });

  test('권한 거부는 로그인 실패가 아니라 SKIPPED이며 토큰·서버 호출이 없다', async () => {
    const d = deps({
      requestPermission: jest.fn().mockImplementation(async () => {
        d.calls.push('permission:request');
        return 'denied';
      }),
    });

    await expect(registerAndroidPushToken(ACCESS_TOKEN, d)).resolves.toBe('SKIPPED');

    expect(d.getExpoPushToken).not.toHaveBeenCalled();
    expect(d.fetch).not.toHaveBeenCalled();
  });

  test('Android가 아니면 네이티브 API를 부르지 않는다', async () => {
    const d = deps({ platform: 'ios' });

    await expect(registerAndroidPushToken(ACCESS_TOKEN, d)).resolves.toBe('SKIPPED');

    expect(d.calls).toEqual([]);
  });

  test('EAS projectId가 없으면 원인을 숨기지 않고 실패한다', async () => {
    const d = deps({ projectId: null });

    await expect(registerAndroidPushToken(ACCESS_TOKEN, d)).rejects.toThrow(
      'EAS projectId가 필요하다.',
    );
    expect(d.getExpoPushToken).not.toHaveBeenCalled();
  });

  test('서버가 거절하면 다음 로그인에서 재시도할 수 있도록 실패를 반환한다', async () => {
    const d = deps({
      fetch: jest.fn().mockResolvedValue({ ok: false, status: 403 }),
    });

    await expect(registerAndroidPushToken(ACCESS_TOKEN, d)).rejects.toThrow(
      '푸시 토큰 등록에 실패했다.',
    );
  });
});
