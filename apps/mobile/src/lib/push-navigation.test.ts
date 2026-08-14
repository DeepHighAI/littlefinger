import type { PushNotificationData } from '@littlefinger/shared';

import {
  createPushNavigationManager,
  type PushNavigationStorage,
  type PushRoute,
} from './push-navigation.ts';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';

function pushData(
  deeplink: PushNotificationData['deeplink'],
  notificationId = NOTIFICATION_ID,
): PushNotificationData {
  return {
    notification_id: notificationId,
    deeplink,
    promise_id: PROMISE_ID,
  };
}

function createHarness(storedValue: string | null = null): {
  manager: ReturnType<typeof createPushNavigationManager>;
  routes: PushRoute[];
  storage: PushNavigationStorage;
  storageEvents: string[];
} {
  let value = storedValue;
  const routes: PushRoute[] = [];
  const storageEvents: string[] = [];
  const storage: PushNavigationStorage = {
    getItem: async (key) => {
      storageEvents.push(`get:${key}`);
      return value;
    },
    setItem: async (key, nextValue) => {
      storageEvents.push(`set:${key}:${nextValue}`);
      value = nextValue;
    },
    removeItem: async (key) => {
      storageEvents.push(`delete:${key}`);
      value = null;
    },
  };
  const manager = createPushNavigationManager({
    logError: () => undefined,
    storage,
  });

  return { manager, routes, storage, storageEvents };
}

describe('Android 푸시 내비게이션', () => {
  test.each([
    ['SCR-A03', { pathname: '/promise/edit', params: { promise_id: PROMISE_ID } }],
    ['SCR-A04', { pathname: '/invite', params: { promise_id: PROMISE_ID } }],
    ['SCR-A05', { pathname: '/home' }],
    [
      'SCR-A06',
      { pathname: '/fulfillment/[promise_id]', params: { promise_id: PROMISE_ID } },
    ],
  ] as const)('%s만 승인된 Expo Router 목적지로 바꾼다', async (deeplink, expectedRoute) => {
    const h = createHarness();

    await h.manager.handle(pushData(deeplink), true, (route) => h.routes.push(route));

    expect(h.routes).toEqual([expectedRoute]);
    expect(h.storageEvents).toEqual([]);
  });

  test.each([
    ['잘못된 알림 UUID', { ...pushData('SCR-A05'), notification_id: 'not-a-uuid' }],
    ['잘못된 약속 UUID', { ...pushData('SCR-A05'), promise_id: 'not-a-uuid' }],
    ['알 수 없는 화면', { ...pushData('SCR-A05'), deeplink: 'SCR-A99' }],
    ['임의 URL 화면', { ...pushData('SCR-A05'), deeplink: 'https://evil.example' }],
    ['추가 URL 필드', { ...pushData('SCR-A05'), url: 'https://evil.example' }],
  ])('%s payload는 현재 경로와 저장소를 바꾸지 않는다', async (_name, payload) => {
    const h = createHarness();

    await h.manager.handle(payload, true, (route) => h.routes.push(route));

    expect(h.routes).toEqual([]);
    expect(h.storageEvents).toEqual([]);
  });

  test('같은 notification_id의 중복 탭은 한 번만 이동한다', async () => {
    const h = createHarness();
    const data = pushData('SCR-A06');

    await h.manager.handle(data, true, (route) => h.routes.push(route));
    await h.manager.handle(data, true, (route) => h.routes.push(route));

    expect(h.routes).toEqual([
      { pathname: '/fulfillment/[promise_id]', params: { promise_id: PROMISE_ID } },
    ]);
  });

  test('로그아웃 상태에서는 검증된 세 필드만 암호화 저장소 경계에 보낸다', async () => {
    const h = createHarness();

    await h.manager.handle(pushData('SCR-A04'), false, (route) => h.routes.push(route));

    expect(h.routes).toEqual([]);
    expect(h.storageEvents).toEqual([
      'set:littlefinger.pending-push-destination.v1:{"notification_id":"11111111-1111-4111-8111-111111111111","deeplink":"SCR-A04","promise_id":"22222222-2222-4222-8222-222222222222"}',
    ]);
  });

  test('로그인 복구 때 저장 값을 먼저 삭제하고 정확히 한 번 이동한다', async () => {
    const h = createHarness(JSON.stringify(pushData('SCR-A03')));

    await h.manager.restore((route) => {
      h.storageEvents.push('navigate');
      h.routes.push(route);
    });
    await h.manager.restore((route) => h.routes.push(route));

    expect(h.routes).toEqual([
      { pathname: '/promise/edit', params: { promise_id: PROMISE_ID } },
    ]);
    expect(h.storageEvents).toEqual([
      'get:littlefinger.pending-push-destination.v1',
      'delete:littlefinger.pending-push-destination.v1',
      'navigate',
    ]);
  });

  test('복구 내비게이션 오류가 나도 삭제된 목적지를 다시 실행하지 않는다', async () => {
    const h = createHarness(JSON.stringify(pushData('SCR-A05')));

    await h.manager.restore(() => {
      throw new Error('navigation unavailable');
    });
    await h.manager.restore((route) => h.routes.push(route));

    expect(h.routes).toEqual([]);
    expect(h.storageEvents).toEqual([
      'get:littlefinger.pending-push-destination.v1',
      'delete:littlefinger.pending-push-destination.v1',
    ]);
  });

  test('빈 초기 복구 뒤 로그아웃 중 저장된 새 목적지는 다음 로그인에 소비한다', async () => {
    const h = createHarness();

    await h.manager.restore((route) => h.routes.push(route));
    await h.manager.handle(pushData('SCR-A04'), false, (route) => h.routes.push(route));
    await h.manager.restore((route) => h.routes.push(route));

    expect(h.routes).toEqual([
      { pathname: '/invite', params: { promise_id: PROMISE_ID } },
    ]);
  });

  test('저장 목적지 복구 뒤 같은 notification_id 응답이 도착해도 다시 이동하지 않는다', async () => {
    const data = pushData('SCR-A06');
    const h = createHarness(JSON.stringify(data));

    await h.manager.restore((route) => h.routes.push(route));
    await h.manager.handle(data, true, (route) => h.routes.push(route));

    expect(h.routes).toEqual([
      { pathname: '/fulfillment/[promise_id]', params: { promise_id: PROMISE_ID } },
    ]);
  });

  test('로그아웃 저장과 로그인 복구가 겹치면 저장 완료를 기다렸다가 이동한다', async () => {
    let finishWrite: (() => void) | undefined;
    let value: string | null = null;
    const routes: PushRoute[] = [];
    const manager = createPushNavigationManager({
      logError: () => undefined,
      storage: {
        getItem: async () => value,
        setItem: async (_key, nextValue) => {
          await new Promise<void>((resolve) => {
            finishWrite = resolve;
          });
          value = nextValue;
        },
        removeItem: async () => {
          value = null;
        },
      },
    });

    const storing = manager.handle(pushData('SCR-A03'), false, (route) => routes.push(route));
    const restoring = manager.restore((route) => routes.push(route));
    finishWrite?.();
    await Promise.all([storing, restoring]);

    expect(routes).toEqual([
      { pathname: '/promise/edit', params: { promise_id: PROMISE_ID } },
    ]);
  });
});
