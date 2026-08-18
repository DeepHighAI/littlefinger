import type { NotificationResponse } from 'expo-notifications';

import type { PushNavigationStorage, PushRoute } from './push-navigation.ts';

const mockSetNotificationHandler = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();
const mockClearLastNotificationResponseAsync = jest.fn().mockResolvedValue(undefined);
const mockSubscriptionRemove = jest.fn();
let responseListener: ((response: NotificationResponse) => void) | null = null;
let storedValue: string | null = null;
let storageSetError: Error | null = null;

const mockEncryptedStorage: PushNavigationStorage = {
  getItem: async () => storedValue,
  setItem: async (_key, value) => {
    if (storageSetError !== null) throw storageSetError;
    storedValue = value;
  },
  removeItem: async () => {
    storedValue = null;
  },
};

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(
    (listener: (response: NotificationResponse) => void) => {
      responseListener = listener;
      return { remove: mockSubscriptionRemove };
    },
  ),
  clearLastNotificationResponseAsync: (...args: unknown[]) =>
    mockClearLastNotificationResponseAsync(...args),
  getLastNotificationResponseAsync: (...args: unknown[]) =>
    mockGetLastNotificationResponseAsync(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
}));
jest.mock(
  './supabase-native.ts',
  () => ({ getMobileEncryptedStorage: () => mockEncryptedStorage }),
  { virtual: true },
);

const { startAndroidPushNavigationNative } = require('./push-navigation-native.ts') as {
  startAndroidPushNavigationNative(events: {
    areProtectedRoutesReady(): boolean;
    logError(error: unknown): void;
    navigate(route: PushRoute): void;
  }): () => void;
};

function response(notificationId: string, deeplink: string): NotificationResponse {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date: 0,
      request: {
        content: {
          body: 'body',
          categoryIdentifier: null,
          data: {
            notification_id: notificationId,
            deeplink,
            promise_id: '22222222-2222-4222-8222-222222222222',
          },
          sound: null,
          subtitle: null,
          title: 'title',
        },
        identifier: notificationId,
        trigger: null,
      },
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(() => resolve()));
}

function deferred<T>(): { promise: Promise<T>; reject(error: unknown): void; resolve(value: T): void } {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  return {
    promise: new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    }),
    reject: (error) => rejectPromise(error),
    resolve: (value) => resolvePromise(value),
  };
}

describe('Expo 알림 수신 연결', () => {
  beforeEach(() => {
    responseListener = null;
    storedValue = null;
    storageSetError = null;
    mockGetLastNotificationResponseAsync.mockReset().mockResolvedValue(null);
    mockClearLastNotificationResponseAsync.mockClear();
    mockSubscriptionRemove.mockClear();
  });

  test('모듈 초기화 때 포그라운드 알림 표시 핸들러를 등록한다', async () => {
    expect(mockSetNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = mockSetNotificationHandler.mock.calls[0]?.[0] as {
      handleNotification(): Promise<unknown>;
    };
    await expect(handler.handleNotification()).resolves.toEqual({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });

  test('콜드 스타트의 마지막 응답을 이동한 뒤 네이티브 응답에서 지운다', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(
      response('33333333-3333-4333-8333-333333333333', 'SCR-A06'),
    );
    const routes: PushRoute[] = [];
    const stop = startAndroidPushNavigationNative({
      areProtectedRoutesReady: () => true,
      logError: () => undefined,
      navigate: (route) => routes.push(route),
    });
    await flushAsyncWork();

    expect(routes).toEqual([
      {
        pathname: '/fulfillment/[promise_id]',
        params: { promise_id: '22222222-2222-4222-8222-222222222222' },
      },
    ]);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    stop();
    expect(mockSubscriptionRemove).toHaveBeenCalledTimes(1);
  });

  test('백그라운드·런타임 탭 응답도 같은 수신 경계로 처리한다', async () => {
    const routes: PushRoute[] = [];
    const stop = startAndroidPushNavigationNative({
      areProtectedRoutesReady: () => true,
      logError: () => undefined,
      navigate: (route) => routes.push(route),
    });
    await flushAsyncWork();

    responseListener?.(response('44444444-4444-4444-8444-444444444444', 'SCR-A04'));
    await flushAsyncWork();

    expect(routes).toEqual([
      {
        pathname: '/invite',
        params: { promise_id: '22222222-2222-4222-8222-222222222222' },
      },
    ]);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    stop();
  });

  test('로그아웃 상태의 초기 암호화 저장 실패는 네이티브 응답을 지우지 않는다', async () => {
    storageSetError = new Error('encrypted write failed');
    const errors: unknown[] = [];
    const stop = startAndroidPushNavigationNative({
      areProtectedRoutesReady: () => false,
      logError: (error) => errors.push(error),
      navigate: () => undefined,
    });
    await flushAsyncWork();

    responseListener?.(response('77777777-7777-4777-8777-777777777777', 'SCR-A04'));
    await flushAsyncWork();

    expect(errors).toHaveLength(1);
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();
    stop();
  });

  test('중단된 listener의 늦은 저장 오류는 stale instance 로그를 남기지 않는다', async () => {
    const write = deferred<void>();
    mockEncryptedStorage.setItem = async () => write.promise;
    const errors: unknown[] = [];
    const stop = startAndroidPushNavigationNative({
      areProtectedRoutesReady: () => false,
      logError: (error) => errors.push(error),
      navigate: () => undefined,
    });
    await flushAsyncWork();

    responseListener?.(response('88888888-8888-4888-8888-888888888888', 'SCR-A04'));
    stop();
    write.reject(new Error('late storage failure'));
    await flushAsyncWork();

    expect(errors).toEqual([]);
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();
    mockEncryptedStorage.setItem = async (_key, value) => {
      storedValue = value;
    };
  });

  test('중단된 cold read는 새 인스턴스가 읽을 네이티브 응답을 지우지 않는다', async () => {
    const staleRead = deferred<NotificationResponse | null>();
    const currentRead = deferred<NotificationResponse | null>();
    mockGetLastNotificationResponseAsync
      .mockImplementationOnce(() => staleRead.promise)
      .mockImplementationOnce(() => currentRead.promise);
    const routes: PushRoute[] = [];
    const events = {
      areProtectedRoutesReady: () => true,
      logError: () => undefined,
      navigate: (route: PushRoute) => routes.push(route),
    };

    const stopStale = startAndroidPushNavigationNative(events);
    stopStale();
    const stopCurrent = startAndroidPushNavigationNative(events);

    staleRead.resolve(response('55555555-5555-4555-8555-555555555555', 'SCR-A05'));
    await flushAsyncWork();
    expect(routes).toEqual([]);
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();

    currentRead.resolve(response('66666666-6666-4666-8666-666666666666', 'SCR-A04'));
    await flushAsyncWork();
    expect(routes).toEqual([
      {
        pathname: '/invite',
        params: { promise_id: '22222222-2222-4222-8222-222222222222' },
      },
    ]);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    stopCurrent();
  });
});
