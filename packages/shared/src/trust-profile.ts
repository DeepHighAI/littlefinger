import { isIsoInstant } from './datetime.ts';
import type { IsoDateTime } from './promise.ts';

export const REMINDER_HOURS = ['09', '12', '20'] as const;
export type ReminderHour = (typeof REMINDER_HOURS)[number];

export interface ReminderPreferences {
  remind_d7: boolean;
  remind_d3: boolean;
  remind_d1: boolean;
  remind_dday: boolean;
  remind_hour: ReminderHour;
}

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  remind_d7: true,
  remind_d3: true,
  remind_d1: true,
  remind_dday: true,
  remind_hour: '09',
};

export interface TrustProfileDetailResponse {
  nickname: string;
  profile_image_url: string | null;
  keep_rate: number | null;
  completed_count: number;
  broken_count: number;
  disputed_count: number;
  unresolved_count: number;
  active_count: number;
  updated_at: IsoDateTime;
  reminders: ReminderPreferences;
}

export interface TrustProfileSettingsUpdateRequest {
  reminders: ReminderPreferences;
}

export interface TrustProfileSettingsUpdateResponse {
  reminders: ReminderPreferences;
  updated_at: IsoDateTime;
}

export interface DeviceTokenUnregisterRequest {
  expo_push_token: string;
}

export interface DeviceTokenUnregisterResponse {
  removed: boolean;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? record
    : null;
}

function isHttpsUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isKeepRate(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100);
}

function asReminderPreferences(value: unknown): ReminderPreferences | null {
  const record = exactRecord(value, [
    'remind_d7',
    'remind_d3',
    'remind_d1',
    'remind_dday',
    'remind_hour',
  ]);
  if (
    record === null ||
    typeof record['remind_d7'] !== 'boolean' ||
    typeof record['remind_d3'] !== 'boolean' ||
    typeof record['remind_d1'] !== 'boolean' ||
    typeof record['remind_dday'] !== 'boolean' ||
    !REMINDER_HOURS.includes(record['remind_hour'] as ReminderHour)
  ) {
    return null;
  }
  return record as unknown as ReminderPreferences;
}

export function asTrustProfileDetailResponse(value: unknown): TrustProfileDetailResponse | null {
  const record = exactRecord(value, [
    'nickname',
    'profile_image_url',
    'keep_rate',
    'completed_count',
    'broken_count',
    'disputed_count',
    'unresolved_count',
    'active_count',
    'updated_at',
    'reminders',
  ]);
  if (
    record === null ||
    typeof record['nickname'] !== 'string' ||
    !isHttpsUrl(record['profile_image_url']) ||
    !isKeepRate(record['keep_rate']) ||
    !isCount(record['completed_count']) ||
    !isCount(record['broken_count']) ||
    !isCount(record['disputed_count']) ||
    !isCount(record['unresolved_count']) ||
    !isCount(record['active_count']) ||
    !isIsoInstant(record['updated_at']) ||
    asReminderPreferences(record['reminders']) === null
  ) {
    return null;
  }
  return record as unknown as TrustProfileDetailResponse;
}

export function asTrustProfileSettingsUpdateResponse(
  value: unknown,
): TrustProfileSettingsUpdateResponse | null {
  const record = exactRecord(value, ['reminders', 'updated_at']);
  if (
    record === null ||
    asReminderPreferences(record['reminders']) === null ||
    !isIsoInstant(record['updated_at'])
  ) {
    return null;
  }
  return record as unknown as TrustProfileSettingsUpdateResponse;
}

export function asDeviceTokenUnregisterResponse(
  value: unknown,
): DeviceTokenUnregisterResponse | null {
  const record = exactRecord(value, ['removed']);
  return record !== null && typeof record['removed'] === 'boolean'
    ? (record as unknown as DeviceTokenUnregisterResponse)
    : null;
}
