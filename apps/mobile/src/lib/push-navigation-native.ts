import * as Notifications from 'expo-notifications';

import {
  createPushNavigationManager,
  type PushRoute,
} from './push-navigation.ts';
import { getMobileEncryptedStorage } from './supabase-native.ts';

export interface AndroidPushNavigationEvents {
  areProtectedRoutesReady(): boolean;
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

const logError = (error: unknown): void => {
  console.error('푸시 알림 처리에 실패했습니다.', error);
};

const manager = createPushNavigationManager({
  storage: getMobileEncryptedStorage(),
  logError: (error) => logError(error),
});

let responseOwnerGeneration = 0;

async function clearLastResponse(reportError: (error: unknown) => void): Promise<void> {
  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch (error) {
    reportError(error);
  }
}

export function startAndroidPushNavigationNative(
  events: AndroidPushNavigationEvents,
): () => void {
  let active = true;
  const ownerGeneration = ++responseOwnerGeneration;
  const isCurrentOwner = (): boolean =>
    active && ownerGeneration === responseOwnerGeneration;
  const reportError = (error: unknown): void => {
    if (isCurrentOwner()) events.logError(error);
  };

  async function handleResponse(response: Notifications.NotificationResponse): Promise<void> {
    if (!isCurrentOwner()) return;
    try {
      const consumed = await manager.handle(
        response.notification.request.content.data,
        events.areProtectedRoutesReady(),
        events.navigate,
        reportError,
      );
      if (consumed && isCurrentOwner()) await clearLastResponse(reportError);
    } catch (error) {
      reportError(error);
    }
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleResponse(response);
  });

  void (async () => {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response !== null && isCurrentOwner()) await handleResponse(response);
    } catch (error) {
      if (isCurrentOwner()) events.logError(error);
    }
  })();

  return () => {
    active = false;
    subscription.remove();
  };
}

export async function restoreAndroidPushNavigationNative(
  navigate: (route: PushRoute) => void,
): Promise<boolean> {
  return manager.restore(navigate);
}
