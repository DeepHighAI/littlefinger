import {
  asPushNotificationData,
  type NotificationDeeplink,
  type PushNotificationData,
} from '@littlefinger/shared';

export type PushRoute =
  | { pathname: '/promise/edit'; params: { promise_id: string } }
  | { pathname: '/promise/[promise_id]'; params: { promise_id: string } }
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
    reportError?: (error: unknown) => void,
  ): Promise<boolean>;
  restore(
    navigate: (route: PushRoute) => void,
    reportError?: (error: unknown) => void,
  ): Promise<void>;
}

export const PENDING_PUSH_DESTINATION_KEY = 'littlefinger.pending-push-destination.v1';

export function routeForNotificationDeeplink(
  deeplink: NotificationDeeplink,
  promiseId: string | null,
): PushRoute | null {
  switch (deeplink) {
    case 'SCR-A03':
      if (promiseId === null) return null;
      return { pathname: '/promise/edit', params: { promise_id: promiseId } };
    case 'SCR-A04':
      if (promiseId === null) return null;
      return { pathname: '/invite', params: { promise_id: promiseId } };
    case 'SCR-A05':
      if (promiseId === null) return null;
      return { pathname: '/promise/[promise_id]', params: { promise_id: promiseId } };
    case 'SCR-A06':
      if (promiseId === null) return null;
      return {
        pathname: '/fulfillment/[promise_id]',
        params: { promise_id: promiseId },
      };
  }
}

interface StoredDestination {
  state: 'PENDING' | 'CONSUMED';
  data: PushNotificationData;
}

function serializeStoredDestination(value: StoredDestination): string {
  return JSON.stringify(value);
}

function parseStoredDestination(value: string): StoredDestination | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    const legacy = asPushNotificationData(parsed);
    if (legacy !== null) return { state: 'PENDING', data: legacy };
    if (typeof parsed !== 'object' || parsed === null) return null;
    const row = parsed as Record<string, unknown>;
    const fields = Object.keys(row);
    const data = asPushNotificationData(row['data']);
    if (
      fields.length !== 2 ||
      !fields.includes('state') ||
      !fields.includes('data') ||
      (row['state'] !== 'PENDING' && row['state'] !== 'CONSUMED') ||
      data === null
    ) return null;
    return { state: row['state'], data };
  } catch {
    return null;
  }
}

export function createPushNavigationManager(
  deps: PushNavigationManagerDeps,
): PushNavigationManager {
  const handledNotificationIds = new Set<string>();
  const navigatedNotificationIds = new Set<string>();
  const activeHandles = new Map<string, Promise<boolean>>();
  let restorationAttempted = false;
  let pendingStorageWrite: Promise<void> | null = null;

  async function handle(
    value: unknown,
    authenticated: boolean,
    navigate: (route: PushRoute) => void,
    reportError = deps.logError,
  ): Promise<boolean> {
    const data = asPushNotificationData(value);
    if (data === null) return true;
    if (
      handledNotificationIds.has(data.notification_id) ||
      navigatedNotificationIds.has(data.notification_id)
    ) return true;
    const active = activeHandles.get(data.notification_id);
    if (active !== undefined) return active;

    const operation = (async (): Promise<boolean> => {
      if (!authenticated) {
        const previousWrite = pendingStorageWrite;
        const write = (async () => {
          if (previousWrite !== null) await previousWrite;
          await deps.storage.setItem(
            PENDING_PUSH_DESTINATION_KEY,
            serializeStoredDestination({ state: 'PENDING', data }),
          );
        })();
        const settledWrite = write.catch(() => undefined);
        pendingStorageWrite = settledWrite;
        try {
          await write;
        } catch (error) {
          reportError(error);
          return false;
        } finally {
          if (pendingStorageWrite === settledWrite) pendingStorageWrite = null;
        }
        handledNotificationIds.add(data.notification_id);
        restorationAttempted = false;
        return true;
      }

      try {
        const route = routeForNotificationDeeplink(data.deeplink, data.promise_id);
        if (route === null) return false;
        navigate(route);
      } catch (error) {
        reportError(error);
        return false;
      }
      handledNotificationIds.add(data.notification_id);
      navigatedNotificationIds.add(data.notification_id);
      return true;
    })();
    activeHandles.set(data.notification_id, operation);
    try {
      return await operation;
    } finally {
      activeHandles.delete(data.notification_id);
    }
  }

  async function restore(
    navigate: (route: PushRoute) => void,
    reportError = deps.logError,
  ): Promise<void> {
    if (restorationAttempted) return;
    restorationAttempted = true;

    const pendingWrite = pendingStorageWrite;
    if (pendingWrite !== null) await pendingWrite;

    let stored: string | null;
    try {
      stored = await deps.storage.getItem(PENDING_PUSH_DESTINATION_KEY);
    } catch (error) {
      reportError(error);
      restorationAttempted = false;
      return;
    }
    if (stored === null) return;

    const destination = parseStoredDestination(stored);
    if (destination === null || destination.state === 'CONSUMED') {
      try {
        await deps.storage.removeItem(PENDING_PUSH_DESTINATION_KEY);
      } catch (error) {
        reportError(error);
        restorationAttempted = false;
      }
      return;
    }
    const data = destination.data;
    if (navigatedNotificationIds.has(data.notification_id)) return;

    try {
      // 이동 직전 소비 상태를 내구화해야 종료·cleanup 실패 뒤 같은 화면을 다시 열지 않는다.
      await deps.storage.setItem(
        PENDING_PUSH_DESTINATION_KEY,
        serializeStoredDestination({ state: 'CONSUMED', data }),
      );
    } catch (error) {
      reportError(error);
      restorationAttempted = false;
      return;
    }

    try {
      const route = routeForNotificationDeeplink(data.deeplink, data.promise_id);
      if (route === null) return;
      navigate(route);
    } catch (error) {
      reportError(error);
      try {
        await deps.storage.setItem(
          PENDING_PUSH_DESTINATION_KEY,
          serializeStoredDestination({ state: 'PENDING', data }),
        );
      } catch (restoreError) {
        reportError(restoreError);
      }
      restorationAttempted = false;
      return;
    }
    navigatedNotificationIds.add(data.notification_id);
    try {
      await deps.storage.removeItem(PENDING_PUSH_DESTINATION_KEY);
    } catch (error) {
      reportError(error);
      restorationAttempted = false;
    }
  }

  return { handle, restore };
}
