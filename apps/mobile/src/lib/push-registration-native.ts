import type { Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getMobileFunctionUrl } from './supabase-native.ts';
import { registerAndroidPushToken } from './push-registration.ts';

const DEFAULT_CHANNEL_ID = 'default';
const DEFAULT_CHANNEL_LABEL = '약속 알림';

function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: unknown } }
    | undefined;
  const configured = extra?.eas?.projectId;
  if (typeof configured === 'string' && configured.length > 0) return configured;

  const runtime = Constants.easConfig?.projectId;
  return typeof runtime === 'string' && runtime.length > 0 ? runtime : null;
}

export async function registerPushForSession(session: Session): Promise<void> {
  await registerAndroidPushToken(session.access_token, {
    platform: Platform.OS,
    projectId: easProjectId(),
    functionUrl: getMobileFunctionUrl('device-token-register'),
    setAndroidChannel: async () => {
      await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
        name: DEFAULT_CHANNEL_LABEL,
        importance: Notifications.AndroidImportance.MAX,
      });
    },
    getPermission: async () => (await Notifications.getPermissionsAsync()).status,
    requestPermission: async () => (await Notifications.requestPermissionsAsync()).status,
    getExpoPushToken: async (projectId) =>
      (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    fetch: async (url, init) => await fetch(url, init),
  });
}
