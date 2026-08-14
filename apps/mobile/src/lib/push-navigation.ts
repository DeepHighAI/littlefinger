import {
  asPushNotificationData,
  type NotificationDeeplink,
  type PushNotificationData,
} from '@littlefinger/shared';

export type PushRoute =
  | { pathname: '/promise/edit'; params: { promise_id: string } }
  | { pathname: '/invite'; params: { promise_id: string } }
  | { pathname: '/home' }
  | { pathname: '/fulfillment/[promise_id]'; params: { promise_id: string } };

export interface PushNavigationStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface PushNavigationManagerDeps {
  storage: PushNavigationStorage;
  logError(error: unknown): void;
}

export interface PushNavigationManager {
  handle(
    value: unknown,
    authenticated: boolean,
    navigate: (route: PushRoute) => void,
  ): Promise<void>;
  restore(navigate: (route: PushRoute) => void): Promise<void>;
}

export const PENDING_PUSH_DESTINATION_KEY = 'littlefinger.pending-push-destination.v1';

function routeFor(deeplink: NotificationDeeplink, promiseId: string): PushRoute {
  switch (deeplink) {
    case 'SCR-A03':
      return { pathname: '/promise/edit', params: { promise_id: promiseId } };
    case 'SCR-A04':
      return { pathname: '/invite', params: { promise_id: promiseId } };
    case 'SCR-A05':
      return { pathname: '/home' };
    case 'SCR-A06':
      return {
        pathname: '/fulfillment/[promise_id]',
        params: { promise_id: promiseId },
      };
  }
}

function parseStoredDestination(value: string): PushNotificationData | null {
  try {
    return asPushNotificationData(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

export function createPushNavigationManager(
  deps: PushNavigationManagerDeps,
): PushNavigationManager {
  const handledNotificationIds = new Set<string>();
  const navigatedNotificationIds = new Set<string>();
  let restorationAttempted = false;
  let pendingStorageWrite: Promise<void> | null = null;

  async function handle(
    value: unknown,
    authenticated: boolean,
    navigate: (route: PushRoute) => void,
  ): Promise<void> {
    const data = asPushNotificationData(value);
    if (
      data === null ||
      handledNotificationIds.has(data.notification_id) ||
      navigatedNotificationIds.has(data.notification_id)
    ) return;

    handledNotificationIds.add(data.notification_id);
    if (!authenticated) {
      restorationAttempted = false;
      const previousWrite = pendingStorageWrite;
      const write = (async () => {
        if (previousWrite !== null) await previousWrite;
        try {
          await deps.storage.setItem(PENDING_PUSH_DESTINATION_KEY, JSON.stringify(data));
        } catch (error) {
          deps.logError(error);
        }
      })();
      pendingStorageWrite = write;
      await write;
      if (pendingStorageWrite === write) pendingStorageWrite = null;
      return;
    }

    navigatedNotificationIds.add(data.notification_id);
    try {
      navigate(routeFor(data.deeplink, data.promise_id));
    } catch (error) {
      deps.logError(error);
    }
  }

  async function restore(navigate: (route: PushRoute) => void): Promise<void> {
    if (restorationAttempted) return;
    restorationAttempted = true;

    const pendingWrite = pendingStorageWrite;
    if (pendingWrite !== null) await pendingWrite;

    let stored: string | null;
    try {
      stored = await deps.storage.getItem(PENDING_PUSH_DESTINATION_KEY);
    } catch (error) {
      deps.logError(error);
      return;
    }
    if (stored === null) return;

    const data = parseStoredDestination(stored);
    try {
      // 삭제를 이동보다 먼저 끝내야 이동 중 종료되어도 같은 목적지를 다시 실행하지 않는다.
      await deps.storage.removeItem(PENDING_PUSH_DESTINATION_KEY);
    } catch (error) {
      deps.logError(error);
      return;
    }
    if (data === null || navigatedNotificationIds.has(data.notification_id)) return;

    navigatedNotificationIds.add(data.notification_id);
    try {
      navigate(routeFor(data.deeplink, data.promise_id));
    } catch (error) {
      deps.logError(error);
    }
  }

  return { handle, restore };
}
