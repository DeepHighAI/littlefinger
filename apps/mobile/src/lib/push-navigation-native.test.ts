import type { NotificationResponse } from 'expo-notifications';

import type { PushNavigationStorage, PushRoute } from './push-navigation.ts';

const mockSetNotificationHandler = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();
const mockClearLastNotificationResponseAsync = jest.fn().mockResolvedValue(undefined);
const mockSubscriptionRemove = jest.fn();
let responseListener: ((response: NotificationResponse) => void) | null = null;
let storedValue: string | null = null;

const mockEncryptedStorage: PushNavigationStorage = {
  getItem: async () => storedValue,
  setItem: async (_key, value) => {
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
    isAuthenticated(): boolean;
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
  await new Promise((resolve) => setImmediate(resolve));
}

describe('Expo 알림 수신 연결', () => {
  beforeEach(() => {
    responseListener = null;
    storedValue = null;
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
      isAuthenticated: () => true,
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
      isAuthenticated: () => true,
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
});
