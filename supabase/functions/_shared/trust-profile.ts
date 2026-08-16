import {
  REMINDER_HOURS,
  type ReminderHour,
  type ReminderPreferences,
} from '../../../packages/shared/src/trust-profile.ts';
import { ApiError } from './errors.ts';

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? record
    : null;
}

export function assertEmptyTrustProfileBody(body: Record<string, unknown>): void {
  if (exactRecord(body, []) === null) {
    throw new ApiError('E_VALIDATION', { field: 'reminders' });
  }
}

export function reminderPreferencesOf(body: Record<string, unknown>): ReminderPreferences {
  const request = exactRecord(body, ['reminders']);
  const reminders = request === null
    ? null
    : exactRecord(request['reminders'], [
        'remind_d7',
        'remind_d3',
        'remind_d1',
        'remind_dday',
        'remind_hour',
      ]);
  if (reminders === null) {
    throw new ApiError('E_VALIDATION', { field: 'reminders' });
  }
  if (
    typeof reminders['remind_d7'] !== 'boolean' ||
    typeof reminders['remind_d3'] !== 'boolean' ||
    typeof reminders['remind_d1'] !== 'boolean' ||
    typeof reminders['remind_dday'] !== 'boolean'
  ) {
    throw new ApiError('E_VALIDATION', { field: 'reminders' });
  }
  if (
    typeof reminders['remind_hour'] !== 'string' ||
    !REMINDER_HOURS.includes(reminders['remind_hour'] as ReminderHour)
  ) {
    throw new ApiError('E_VALIDATION', { field: 'remind_hour' });
  }
  return reminders as unknown as ReminderPreferences;
}

export function expoPushTokenOf(body: Record<string, unknown>): string {
  const request = exactRecord(body, ['expo_push_token']);
  const token = request?.['expo_push_token'];
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new ApiError('E_VALIDATION', { field: 'expo_push_token' });
  }
  return token;
}
