import type {
  PromiseHomeCursor,
  PromiseHomeListRequest,
  PromiseHomeTab,
} from '../../../packages/shared/src/api.ts';
import { isIsoInstant } from '../../../packages/shared/src/datetime.ts';
import {
  PROMISE_HISTORY_TABS,
  PROMISE_HOME_TABS,
} from '../../../packages/shared/src/promise-home.ts';
import { ApiError } from './errors.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
// 표를 복사하지 않는다(errors.ts 의 원칙과 동일) — 탭 어휘의 정본은 packages/shared 다.
const TABS: readonly PromiseHomeTab[] = [...PROMISE_HOME_TABS, ...PROMISE_HISTORY_TABS];

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? record
    : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function cursorOf(value: unknown, tab: PromiseHomeTab): PromiseHomeCursor {
  if (tab === 'ACTIVE') {
    const cursor = exactRecord(value, ['tab', 'status_rank', 'end_date', 'promise_id']);
    if (
      cursor === null ||
      cursor['tab'] !== tab ||
      (cursor['status_rank'] !== 0 && cursor['status_rank'] !== 1) ||
      !isIsoDate(cursor['end_date']) ||
      !isUuid(cursor['promise_id'])
    ) throw new ApiError('E_VALIDATION', { field: 'cursor' });
    return cursor as unknown as PromiseHomeCursor;
  }
  if (tab === 'WAITING') {
    const cursor = exactRecord(value, ['tab', 'updated_at', 'promise_id']);
    if (
      cursor === null ||
      cursor['tab'] !== tab ||
      !isIsoInstant(cursor['updated_at']) ||
      !isUuid(cursor['promise_id'])
    ) throw new ApiError('E_VALIDATION', { field: 'cursor' });
    return cursor as unknown as PromiseHomeCursor;
  }
  const cursor = exactRecord(value, ['tab', 'closed_at', 'updated_at', 'promise_id']);
  if (
    cursor === null ||
    cursor['tab'] !== tab ||
    (cursor['closed_at'] !== null && !isIsoInstant(cursor['closed_at'])) ||
    !isIsoInstant(cursor['updated_at']) ||
    !isUuid(cursor['promise_id'])
  ) throw new ApiError('E_VALIDATION', { field: 'cursor' });
  return cursor as unknown as PromiseHomeCursor;
}

export function promiseHomeListRequestOf(
  body: Record<string, unknown>,
): { tab: PromiseHomeTab; cursor: PromiseHomeCursor | null } {
  const keys = body['cursor'] === undefined ? ['tab'] : ['tab', 'cursor'];
  if (exactRecord(body, keys) === null || !TABS.includes(body['tab'] as PromiseHomeTab)) {
    throw new ApiError('E_VALIDATION', { field: 'tab' });
  }
  const tab = body['tab'] as PromiseHomeTab;
  const request: PromiseHomeListRequest = { tab };
  if (body['cursor'] !== undefined) request.cursor = cursorOf(body['cursor'], tab);
  return { tab: request.tab, cursor: request.cursor ?? null };
}
