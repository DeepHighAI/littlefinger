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

  test('같은 값을 다시 저장해도 CTR 키스트림을 재사용하지 않는다', async () => {
    // 같은 키와 counter를 재사용하면 두 암호문의 XOR로 원문 관계가 노출된다.
    const { asyncValues, deps } = memoryDeps();
    const generatedValues = [
      Uint8Array.from({ length: 32 }, (_, index) => index),
      Uint8Array.from({ length: 32 }, (_, index) => 64 + index),
      Uint8Array.from({ length: 32 }, (_, index) => 128 + index),
    ];
    deps.randomBytes = () => {
      const next = generatedValues.shift();
      if (next === undefined) throw new Error('unexpected random generation');
      return next;
    };
    const store = new LargeSecureStore(deps);

    await store.setItem('sb-session', '{"access_token":"same-secret"}');
    const firstCiphertext = asyncValues.get('sb-session');
    await store.setItem('sb-session', '{"access_token":"same-secret"}');
    const secondCiphertext = asyncValues.get('sb-session');

    expect(firstCiphertext).toBeDefined();
    expect(secondCiphertext).toBeDefined();
    expect(secondCiphertext).not.toBe(firstCiphertext);
    await expect(store.getItem('sb-session')).resolves.toBe('{"access_token":"same-secret"}');
  });

  test('기존 고정 counter 형식의 암호문을 계속 복호화한다', async () => {
    // 앱 업데이트가 기존 로그인 세션과 저장된 초대·푸시 목적지를 로그아웃시키면 안 된다.
    const { asyncValues, deps, secureValues } = memoryDeps();
    secureValues.set(
      'legacy-session',
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    );
    asyncValues.set(
      'legacy-session',
      '8b7f17cd29dcec96f982f45a2dac14072ccfd4b3d001f0d86bdacc413a51',
    );

    const store = new LargeSecureStore(deps);

    await expect(store.getItem('legacy-session')).resolves.toBe(
      '{"access_token":"same-secret"}',
    );
  });

  test('기존 값 갱신 중 프로세스가 종료되어도 마지막 커밋 값은 복호화된다', async () => {
    // 암호문보다 먼저 암호화 키를 교체하면 재시작한 프로세스가 마지막 커밋 값을 잃는다.
    const { deps } = memoryDeps();
    const generatedKeys = [
      Uint8Array.from({ length: 32 }, (_, index) => index),
      Uint8Array.from({ length: 32 }, (_, index) => 64 + index),
      Uint8Array.from({ length: 32 }, (_, index) => 128 + index),
    ];
    deps.randomBytes = () => {
      const next = generatedKeys.shift();
      if (next === undefined) throw new Error('unexpected key generation');
      return next;
    };

    const originalSetItem = deps.asyncStorage.setItem;
    let writeCount = 0;
    let signalWriteStarted: () => void = () => undefined;
    const writeStarted = new Promise<void>((resolve) => {
      signalWriteStarted = resolve;
    });
    let releaseWrite: () => void = () => undefined;
    const writeReleased = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    deps.asyncStorage.setItem = async (key, value) => {
      writeCount += 1;
      if (writeCount === 2) {
        signalWriteStarted();
        await writeReleased;
      }
      await originalSetItem(key, value);
    };

    const store = new LargeSecureStore(deps);
    await store.setItem('push-marker', '{"state":"PENDING"}');

    const updating = store.setItem('push-marker', '{"state":"CONSUMED"}');
    await writeStarted;

    const restartedStore = new LargeSecureStore(deps);
    await expect(restartedStore.getItem('push-marker')).resolves.toBe('{"state":"PENDING"}');

    releaseWrite();
    await updating;
    await expect(restartedStore.getItem('push-marker')).resolves.toBe('{"state":"CONSUMED"}');
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
