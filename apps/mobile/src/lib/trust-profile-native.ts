import type {
  DeviceTokenUnregisterResponse,
  ReminderPreferences,
  TrustProfileDetailResponse,
  TrustProfileSettingsUpdateResponse,
} from '@littlefinger/shared';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { callMobileFunctionNative } from './mobile-api-native.ts';
import { runIntentionalSignOut } from './intentional-sign-out.ts';
import { logoutCurrentDevice as logoutCurrentDeviceWith } from './profile-session.ts';
import { resolveCurrentAndroidPushToken } from './push-registration-native.ts';
import { getMobileEncryptedStorage, getMobileSupabaseClient } from './supabase-native.ts';
import {
  loadTrustProfile as loadTrustProfileWith,
  unregisterDeviceToken as unregisterDeviceTokenWith,
  updateTrustProfileSettings as updateTrustProfileSettingsWith,
} from './trust-profile-api.ts';

const deps = { call: callMobileFunctionNative };

export async function loadTrustProfile(): Promise<TrustProfileDetailResponse> {
  return await loadTrustProfileWith(deps);
}

export async function updateTrustProfileSettings(
  reminders: ReminderPreferences,
): Promise<TrustProfileSettingsUpdateResponse> {
  return await updateTrustProfileSettingsWith(
    reminders,
    createTrustProfileIdempotencyKey(),
    deps,
  );
}

export async function unregisterDeviceToken(
  expoPushToken: string,
): Promise<DeviceTokenUnregisterResponse> {
  return await unregisterDeviceTokenWith(
    expoPushToken,
    createTrustProfileIdempotencyKey(),
    deps,
  );
}

export function createTrustProfileIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export async function logoutCurrentDeviceNative(userId: string): Promise<void> {
  const client = getMobileSupabaseClient();
  await logoutCurrentDeviceWith(userId, {
    platform: Platform.OS,
    storage: getMobileEncryptedStorage(),
    resolveCurrentAndroidToken: resolveCurrentAndroidPushToken,
    unregister: async (token, idempotencyKey) =>
      await unregisterDeviceTokenWith(token, idempotencyKey, deps),
    randomUuid: createTrustProfileIdempotencyKey,
    signOut: async () =>
      await runIntentionalSignOut(async () => {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error !== null) throw error;
      }),
  });
}
