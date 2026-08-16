import {
  DEFAULT_REMINDER_PREFERENCES,
  ENDPOINT,
  type Endpoint,
} from '@littlefinger/shared';
import * as Crypto from 'expo-crypto';

jest.mock('./mobile-api-native.ts', () => ({ callMobileFunctionNative: jest.fn() }));
jest.mock('./push-registration-native.ts', () => ({
  resolveCurrentAndroidPushToken: jest.fn(),
}));
jest.mock('./supabase-native.ts', () => ({
  getMobileEncryptedStorage: jest.fn(),
  getMobileSupabaseClient: jest.fn(),
}));

import { callMobileFunctionNative } from './mobile-api-native.ts';
import {
  createTrustProfileIdempotencyKey,
  unregisterDeviceToken as unregisterDeviceTokenNative,
  updateTrustProfileSettings as updateTrustProfileSettingsNative,
} from './trust-profile-native.ts';

import {
  loadTrustProfile,
  unregisterDeviceToken,
  updateTrustProfileSettings,
  type TrustProfileApiDeps,
} from './trust-profile-api.ts';

const KEY = '11111111-1111-4111-8111-111111111111';
const EXPO_TOKEN = 'ExponentPushToken[device-token]';

function deps() {
  const call = jest.fn<Promise<unknown>, [Endpoint, unknown, unknown]>();
  return { call, deps: { call } as TrustProfileApiDeps };
}

describe('F-09 mobile trust profile API', () => {
  afterEach(() => jest.restoreAllMocks());

  test('프로필 조회는 비멱등 빈 본문 호출이다', async () => {
    const d = deps();
    const expected = { nickname: '리틀핑거' };
    d.call.mockResolvedValue(expected);

    await expect(loadTrustProfile(d.deps)).resolves.toBe(expected);
    expect(d.call).toHaveBeenCalledWith(ENDPOINT.trustProfile, {}, { idempotent: false });
  });

  test('설정 저장은 호출자가 정한 UUID와 reminders만 보낸다', async () => {
    const d = deps();
    const expected = { reminders: DEFAULT_REMINDER_PREFERENCES, updated_at: '2026-08-17T00:00:00Z' };
    d.call.mockResolvedValue(expected);

    await expect(updateTrustProfileSettings(DEFAULT_REMINDER_PREFERENCES, KEY, d.deps)).resolves.toBe(expected);
    expect(d.call).toHaveBeenCalledWith(
      ENDPOINT.trustProfileSettingsUpdate,
      { reminders: DEFAULT_REMINDER_PREFERENCES },
      { idempotent: true, idempotencyKey: KEY },
    );
  });

  test('기기 토큰 해제는 호출자가 정한 UUID와 토큰만 보낸다', async () => {
    const d = deps();
    d.call.mockResolvedValue({ removed: true });

    await expect(unregisterDeviceToken(EXPO_TOKEN, KEY, d.deps)).resolves.toEqual({ removed: true });
    expect(d.call).toHaveBeenCalledWith(
      ENDPOINT.deviceTokenUnregister,
      { expo_push_token: EXPO_TOKEN },
      { idempotent: true, idempotencyKey: KEY },
    );
  });

  test('네이티브 mutation은 매번 새 Expo UUID를 사용한다', async () => {
    const randomUuid = jest.spyOn(Crypto, 'randomUUID')
      .mockReturnValueOnce(KEY)
      .mockReturnValueOnce('44444444-4444-4444-8444-444444444444');
    jest.mocked(callMobileFunctionNative)
      .mockResolvedValueOnce({ reminders: DEFAULT_REMINDER_PREFERENCES, updated_at: '2026-08-17T00:00:00Z' })
      .mockResolvedValueOnce({ removed: true });

    await updateTrustProfileSettingsNative(DEFAULT_REMINDER_PREFERENCES);
    await unregisterDeviceTokenNative(EXPO_TOKEN);

    expect(randomUuid).toHaveBeenCalledTimes(2);
    expect(callMobileFunctionNative).toHaveBeenNthCalledWith(
      1,
      ENDPOINT.trustProfileSettingsUpdate,
      { reminders: DEFAULT_REMINDER_PREFERENCES },
      { idempotent: true, idempotencyKey: KEY },
    );
    expect(callMobileFunctionNative).toHaveBeenNthCalledWith(
      2,
      ENDPOINT.deviceTokenUnregister,
      { expo_push_token: EXPO_TOKEN },
      { idempotent: true, idempotencyKey: '44444444-4444-4444-8444-444444444444' },
    );
  });

  test('idempotency key 생성은 Expo crypto UUID를 그대로 사용한다', () => {
    jest.spyOn(Crypto, 'randomUUID').mockReturnValue(KEY);
    expect(createTrustProfileIdempotencyKey()).toBe(KEY);
  });
});
