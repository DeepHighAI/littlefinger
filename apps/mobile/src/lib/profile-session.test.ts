import {
  logoutCurrentDevice,
  registeredPushTokenStorageKey,
  type ProfileSessionDeps,
} from './profile-session.ts';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const KEY = '33333333-3333-4333-8333-333333333333';
const EXPO_TOKEN = 'ExponentPushToken[device-token]';

function deps(options: {
  cached?: string | null;
  platform?: string;
  signOut?: () => Promise<void>;
  unregister?: () => Promise<unknown>;
} = {}) {
  const calls: string[] = [];
  const storage = {
    getItem: jest.fn().mockImplementation(async () => {
      calls.push('cache:get');
      return options.cached ?? null;
    }),
    setItem: jest.fn(),
    removeItem: jest.fn().mockImplementation(async () => { calls.push('cache:remove'); }),
  };
  const d: ProfileSessionDeps = {
    platform: options.platform ?? 'android',
    storage,
    resolveCurrentAndroidToken: jest.fn().mockImplementation(async () => {
      calls.push('channel');
      calls.push('token');
      return EXPO_TOKEN;
    }),
    unregister: jest.fn().mockImplementation(async () => {
      calls.push('unregister');
      return await (options.unregister?.() ?? Promise.resolve({ removed: true }));
    }),
    randomUuid: () => KEY,
    signOut: jest.fn().mockImplementation(async () => {
      calls.push('signout');
      await (options.signOut?.() ?? Promise.resolve());
    }),
  };
  return { calls, deps: d, storage };
}

describe('F-09 safe current-device logout', () => {
  test('암호화 토큰 캐시 키는 사용자별로 분리되고 토큰을 포함하지 않는다', () => {
    expect(registeredPushTokenStorageKey(USER_A)).toBe(`push-token:${USER_A}`);
    expect(registeredPushTokenStorageKey(USER_A)).not.toBe(registeredPushTokenStorageKey(USER_B));
    expect(registeredPushTokenStorageKey(USER_A)).not.toContain(EXPO_TOKEN);
  });

  test('캐시된 토큰은 네이티브 권한·토큰 조회 없이 해제한 뒤 로그아웃한다', async () => {
    const d = deps({ cached: EXPO_TOKEN });

    await expect(logoutCurrentDevice(USER_A, d.deps)).resolves.toBeUndefined();
    expect(d.calls).toEqual(['cache:get', 'unregister', 'signout', 'cache:remove']);
    expect(d.deps.resolveCurrentAndroidToken).not.toHaveBeenCalled();
    expect(d.deps.unregister).toHaveBeenCalledWith(EXPO_TOKEN, KEY);
  });

  test('Android 캐시가 없으면 권한 요청 없이 채널·현재 토큰을 조회해 해제한다', async () => {
    const d = deps();

    await logoutCurrentDevice(USER_A, d.deps);

    expect(d.calls).toEqual(['cache:get', 'channel', 'token', 'unregister', 'signout']);
    expect(d.storage.removeItem).not.toHaveBeenCalled();
  });

  test('토큰 해제 실패는 sign-out과 캐시 제거를 실행하지 않는다', async () => {
    const d = deps({ cached: EXPO_TOKEN, unregister: async () => { throw new Error('unregister failed'); } });

    await expect(logoutCurrentDevice(USER_A, d.deps)).rejects.toThrow('unregister failed');
    expect(d.calls).toEqual(['cache:get', 'unregister']);
    expect(d.deps.signOut).not.toHaveBeenCalled();
    expect(d.storage.removeItem).not.toHaveBeenCalled();
  });

  test('sign-out 실패는 안전한 재시도를 위해 캐시를 보존한다', async () => {
    const d = deps({ cached: EXPO_TOKEN, signOut: async () => { throw new Error('signout failed'); } });

    await expect(logoutCurrentDevice(USER_A, d.deps)).rejects.toThrow('signout failed');
    expect(d.calls).toEqual(['cache:get', 'unregister', 'signout']);
    expect(d.storage.removeItem).not.toHaveBeenCalled();
  });

  test('Android가 아니면 Expo API 없이 로컬 로그아웃한다', async () => {
    const d = deps({ platform: 'ios' });

    await logoutCurrentDevice(USER_A, d.deps);

    expect(d.calls).toEqual(['cache:get', 'signout']);
    expect(d.deps.resolveCurrentAndroidToken).not.toHaveBeenCalled();
    expect(d.deps.unregister).not.toHaveBeenCalled();
  });
});
