import type {
  PromiseHomeCard,
  PromiseHomeCursor,
  PromiseHomeListResponse,
  PromiseHomePerson,
  PromiseHomeTab,
} from './api.ts';
import { isIsoInstant } from './datetime.ts';
import { PROMISE_STATUSES, type PromiseStatus } from './promise.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
/** 홈 화면의 탭. counts 도 이 3키 정확 일치다 — 구버전 파서와의 영구 계약. */
export const PROMISE_HOME_TABS = ['ACTIVE', 'WAITING', 'COMPLETED'] as const;
/** SCR-A09 히스토리 탭(ADR 0011). counts 는 이 4키 정확 일치다. */
export const PROMISE_HISTORY_TABS = ['DONE', 'BROKEN', 'UNSETTLED', 'DECLINED'] as const;
const TABS: readonly PromiseHomeTab[] = [...PROMISE_HOME_TABS, ...PROMISE_HISTORY_TABS];
const ROLES = ['CREATOR', 'PARTNER', 'WITNESS'] as const;
const TAB_STATUSES: Record<PromiseHomeTab, readonly PromiseStatus[]> = {
  ACTIVE: ['ACTIVE', 'AMEND_PENDING', 'CHECKING'],
  WAITING: ['DRAFT', 'PENDING'],
  COMPLETED: [
    'COMPLETED',
    'BROKEN',
    'DISPUTED',
    'UNRESOLVED',
    'DECLINED',
    'CANCELED',
  ],
  DONE: ['COMPLETED'],
  BROKEN: ['BROKEN'],
  // DISPUTED 를 '불이행'으로 묶지 않는다 — P1(판정 금지). 미확정 종결과 함께 중립 탭이다.
  UNSETTLED: ['DISPUTED', 'UNRESOLVED'],
  DECLINED: ['DECLINED', 'CANCELED'],
};

function recordWithKeys(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
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

function isHttpsUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function asPerson(value: unknown): PromiseHomePerson | null {
  const record = recordWithKeys(value, ['nickname', 'profile_image_url']);
  if (
    record === null ||
    typeof record['nickname'] !== 'string' ||
    !isHttpsUrl(record['profile_image_url'])
  ) {
    return null;
  }
  return record as unknown as PromiseHomePerson;
}

function asCard(value: unknown, tab: PromiseHomeTab, pinned: boolean): PromiseHomeCard | null {
  const record = recordWithKeys(value, [
    'promise_id',
    'title',
    'status',
    'end_date',
    'updated_at',
    'closed_at',
    'my_role',
    'creator',
    'partner',
    'has_witness',
    'needs_response',
  ]);
  if (record === null) return null;

  const status = record['status'];
  if (
    !isUuid(record['promise_id']) ||
    typeof record['title'] !== 'string' ||
    typeof status !== 'string' ||
    !(PROMISE_STATUSES as readonly string[]).includes(status) ||
    !TAB_STATUSES[tab].includes(status as PromiseStatus) ||
    (record['end_date'] !== null && !isIsoDate(record['end_date'])) ||
    !isIsoInstant(record['updated_at']) ||
    (record['closed_at'] !== null && !isIsoInstant(record['closed_at'])) ||
    !ROLES.includes(record['my_role'] as (typeof ROLES)[number]) ||
    asPerson(record['creator']) === null ||
    (record['partner'] !== null && asPerson(record['partner']) === null) ||
    typeof record['has_witness'] !== 'boolean' ||
    typeof record['needs_response'] !== 'boolean' ||
    (pinned && status !== 'ACTIVE' && status !== 'CHECKING')
  ) {
    return null;
  }
  return record as unknown as PromiseHomeCard;
}

function asCursor(value: unknown, tab: PromiseHomeTab): PromiseHomeCursor | null {
  if (value === null) return null;
  if (tab === 'ACTIVE') {
    const record = recordWithKeys(value, ['tab', 'status_rank', 'end_date', 'promise_id']);
    if (
      record === null ||
      record['tab'] !== tab ||
      (record['status_rank'] !== 0 && record['status_rank'] !== 1) ||
      (record['end_date'] !== null && !isIsoDate(record['end_date'])) ||
      !isUuid(record['promise_id'])
    ) return null;
    return record as unknown as PromiseHomeCursor;
  }
  if (tab === 'WAITING') {
    const record = recordWithKeys(value, ['tab', 'updated_at', 'promise_id']);
    if (
      record === null ||
      record['tab'] !== tab ||
      !isIsoInstant(record['updated_at']) ||
      !isUuid(record['promise_id'])
    ) return null;
    return record as unknown as PromiseHomeCursor;
  }
  const record = recordWithKeys(value, ['tab', 'closed_at', 'updated_at', 'promise_id']);
  if (
    record === null ||
    record['tab'] !== tab ||
    (record['closed_at'] !== null && !isIsoInstant(record['closed_at'])) ||
    !isIsoInstant(record['updated_at']) ||
    !isUuid(record['promise_id'])
  ) return null;
  return record as unknown as PromiseHomeCursor;
}

function asCounts(
  value: unknown,
  expectedTab: PromiseHomeTab,
): Readonly<Partial<Record<PromiseHomeTab, number>>> | null {
  // 요청 탭의 패밀리(홈 3키 / 히스토리 4키)만 정확 일치로 받는다 — 키가 섞이면 서버가 아니다.
  const family: readonly PromiseHomeTab[] = (
    PROMISE_HISTORY_TABS as readonly PromiseHomeTab[]
  ).includes(expectedTab)
    ? PROMISE_HISTORY_TABS
    : PROMISE_HOME_TABS;
  const record = recordWithKeys(value, family);
  if (record === null) return null;
  for (const tab of family) {
    const count = record[tab];
    if (!Number.isInteger(count) || (count as number) < 0) return null;
  }
  return record as Readonly<Partial<Record<PromiseHomeTab, number>>>;
}

export function asPromiseHomeListResponse(
  value: unknown,
  expectedTab: PromiseHomeTab,
): PromiseHomeListResponse | null {
  const payload = recordWithKeys(value, ['items', 'pinned', 'counts', 'next_cursor']);
  if (payload === null || !TABS.includes(expectedTab)) return null;
  if (!Array.isArray(payload['items']) || !Array.isArray(payload['pinned'])) return null;
  const items = payload['items'].map((item) => asCard(item, expectedTab, false));
  const pinned = payload['pinned'].map((item) => asCard(item, expectedTab, true));
  const counts = asCounts(payload['counts'], expectedTab);
  const cursor = asCursor(payload['next_cursor'], expectedTab);
  if (
    items.some((item) => item === null) ||
    pinned.some((item) => item === null) ||
    counts === null ||
    (payload['next_cursor'] !== null && cursor === null) ||
    (expectedTab !== 'ACTIVE' && pinned.length > 0)
  ) return null;
  return payload as unknown as PromiseHomeListResponse;
}
