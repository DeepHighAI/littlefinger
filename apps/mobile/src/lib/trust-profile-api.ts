import {
  ENDPOINT,
  type DeviceTokenUnregisterResponse,
  type Endpoint,
  type ReminderPreferences,
  type TrustProfileDetailResponse,
  type TrustProfileSettingsUpdateResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface TrustProfileApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function loadTrustProfile(
  deps: TrustProfileApiDeps,
): Promise<TrustProfileDetailResponse> {
  return await deps.call(ENDPOINT.trustProfile, {}, { idempotent: false });
}

export async function updateTrustProfileSettings(
  reminders: ReminderPreferences,
  idempotencyKey: string,
  deps: TrustProfileApiDeps,
): Promise<TrustProfileSettingsUpdateResponse> {
  return await deps.call(
    ENDPOINT.trustProfileSettingsUpdate,
    { reminders },
    { idempotent: true, idempotencyKey },
  );
}

export async function unregisterDeviceToken(
  expoPushToken: string,
  idempotencyKey: string,
  deps: TrustProfileApiDeps,
): Promise<DeviceTokenUnregisterResponse> {
  return await deps.call(
    ENDPOINT.deviceTokenUnregister,
    { expo_push_token: expoPushToken },
    { idempotent: true, idempotencyKey },
  );
}
