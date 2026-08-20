import type { Localized } from '@littlefinger/shared';
import type { Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getCurrentLocale } from './locale-native';
import { getMobileFunctionUrl } from './supabase-native.ts';
import { getMobileEncryptedStorage } from './supabase-native.ts';
import { registeredPushTokenStorageKey } from './profile-session.ts';
import { registerAndroidPushToken } from './push-registration.ts';

// 채널 ID 는 사용자의 기존 알림 설정에 묶여 있어 절대 바꾸지 않는다 — 표시 이름만 로케일을 따른다.
const DEFAULT_CHANNEL_ID = 'default';
const DEFAULT_CHANNEL_LABEL: Localized<string> = {
  ko: '약속 알림',
  en: 'Promise notifications',
};

function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: unknown } }
    | undefined;
  const configured = extra?.eas?.projectId;
  if (typeof configured === 'string' && configured.length > 0) return configured;

  const runtime = Constants.easConfig?.projectId;
  return typeof runtime === 'string' && runtime.length > 0 ? runtime : null;
}

async function setDefaultAndroidChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: DEFAULT_CHANNEL_LABEL[getCurrentLocale()],
    importance: Notifications.AndroidImportance.MAX,
  });
}

export async function resolveCurrentAndroidPushToken(): Promise<string> {
  await setDefaultAndroidChannel();
  const projectId = easProjectId();
  if (projectId === null) throw new Error('EAS projectId가 필요하다.');
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function registerPushForSession(session: Session): Promise<void> {
  await registerAndroidPushToken(session.access_token, {
    platform: Platform.OS,
    projectId: easProjectId(),
    functionUrl: getMobileFunctionUrl('device-token-register'),
    setAndroidChannel: setDefaultAndroidChannel,
    getPermission: async () => (await Notifications.getPermissionsAsync()).status,
    requestPermission: async () => (await Notifications.requestPermissionsAsync()).status,
    getExpoPushToken: async (projectId) =>
      (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    persistRegisteredToken: async (token) => {
      await getMobileEncryptedStorage().setItem(
        registeredPushTokenStorageKey(session.user.id),
        token,
      );
    },
    fetch: async (url, init) => await fetch(url, init),
  });
}
