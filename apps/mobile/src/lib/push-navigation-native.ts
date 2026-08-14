import * as Notifications from 'expo-notifications';

import {
  createPushNavigationManager,
  type PushRoute,
} from './push-navigation.ts';
import { getMobileEncryptedStorage } from './supabase-native.ts';

export interface AndroidPushNavigationEvents {
  isAuthenticated(): boolean;
  navigate(route: PushRoute): void;
  logError(error: unknown): void;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let logError = (error: unknown): void => {
  console.error('푸시 알림 처리에 실패했습니다.', error);
};

const manager = createPushNavigationManager({
  storage: getMobileEncryptedStorage(),
  logError: (error) => logError(error),
});

async function clearLastResponse(): Promise<void> {
  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch (error) {
    logError(error);
  }
}

export function startAndroidPushNavigationNative(
  events: AndroidPushNavigationEvents,
): () => void {
  let active = true;
  logError = events.logError;

  async function handleResponse(response: Notifications.NotificationResponse): Promise<void> {
    try {
      if (active) {
        await manager.handle(
          response.notification.request.content.data,
          events.isAuthenticated(),
          events.navigate,
        );
      }
    } catch (error) {
      events.logError(error);
    } finally {
      await clearLastResponse();
    }
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleResponse(response);
  });

  void (async () => {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response !== null) await handleResponse(response);
    } catch (error) {
      events.logError(error);
    }
  })();

  return () => {
    active = false;
    subscription.remove();
  };
}

export async function restoreAndroidPushNavigationNative(
  navigate: (route: PushRoute) => void,
): Promise<void> {
  await manager.restore(navigate);
}
