import { LargeSecureStore, type LargeSecureStoreDeps } from './large-secure-store.ts';

function memoryDeps() {
  const asyncValues = new Map<string, string>();
  const secureValues = new Map<string, string>();
  const deps: LargeSecureStoreDeps = {
    asyncStorage: {
      getItem: async (key) => asyncValues.get(key) ?? null,
      setItem: async (key, value) => {
        asyncValues.set(key, value);
      },
      removeItem: async (key) => {
        asyncValues.delete(key);
      },
    },
    secureStore: {
      getItemAsync: async (key) => secureValues.get(key) ?? null,
      setItemAsync: async (key, value) => {
        secureValues.set(key, value);
      },
      deleteItemAsync: async (key) => {
        secureValues.delete(key);
      },
    },
    randomBytes: () => Uint8Array.from({ length: 32 }, (_, index) => index),
  };
  return { asyncValues, deps, secureValues };
}

describe('LargeSecureStore', () => {
  test('세션 원문은 AsyncStorage에 남지 않고 SecureStore 키로 복호화된다', async () => {
    // 암호화를 빼거나 키까지 AsyncStorage 에 넣으면 이 테스트가 깨져야 한다.
    const { asyncValues, deps, secureValues } = memoryDeps();
    const store = new LargeSecureStore(deps);
    const session = JSON.stringify({
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
    });

    await store.setItem('sb-session', session);

    expect(asyncValues.get('sb-session')).toBeDefined();
    expect(asyncValues.get('sb-session')).not.toContain('access-secret');
    expect(secureValues.get('sb-session')).toBe(
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    );
    expect(await store.getItem('sb-session')).toBe(session);
  });

  test('세션 삭제는 암호문과 암호화 키를 함께 지운다', async () => {
    // SecureStore 키만 남으면 로그아웃한 계정의 보안 재료가 기기에 계속 쌓인다.
    const { asyncValues, deps, secureValues } = memoryDeps();
    const store = new LargeSecureStore(deps);
    await store.setItem('sb-session', '{"access_token":"secret"}');

    await store.removeItem('sb-session');

    expect(asyncValues.has('sb-session')).toBe(false);
    expect(secureValues.has('sb-session')).toBe(false);
  });

  test('SecureStore 삭제 실패 때 암호문을 복원해 다음 cleanup을 재시도할 수 있다', async () => {
    const { asyncValues, deps, secureValues } = memoryDeps();
    let deleteAttempts = 0;
    deps.secureStore.deleteItemAsync = async (key) => {
      deleteAttempts += 1;
      if (deleteAttempts === 1) throw new Error('secure cleanup failed');
      secureValues.delete(key);
    };
    const store = new LargeSecureStore(deps);
    await store.setItem('push-marker', '{"state":"CONSUMED"}');

    await expect(store.removeItem('push-marker')).rejects.toThrow('secure cleanup failed');
    await expect(store.getItem('push-marker')).resolves.toBe('{"state":"CONSUMED"}');
    await store.removeItem('push-marker');

    expect(asyncValues.has('push-marker')).toBe(false);
    expect(secureValues.has('push-marker')).toBe(false);
  });
});
