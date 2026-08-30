import type {
  PromiseAmendCreateResponse,
  PromiseAmendRespondResponse,
  PromiseAmendWithdrawResponse,
  PromiseDetailActor,
  PromiseVersionListResponse,
} from './api.ts';
import { isIsoInstant } from './datetime.ts';
import { asPromiseDetailVersion } from './promise-detail.ts';
import type { Keeper, PromiseCategory } from './promise.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type PromiseAmendField =
  | 'title'
  | 'body'
  | 'category'
  | 'end_date'
  | 'keeper'
  | 'reward'
  | 'penalty';

interface ComparablePromiseContent {
  title: string;
  body: string;
  category: PromiseCategory;
  end_date: string | null;
  keeper: Keeper;
  reward: string | null;
  penalty: string | null;
}

const AMEND_FIELDS: readonly PromiseAmendField[] = [
  'title',
  'body',
  'category',
  'end_date',
  'keeper',
  'reward',
  'penalty',
];

function exactRecord(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length && actual.every((field, index) => field === expected[index])
    ? record
    : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
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

function asActor(value: unknown): PromiseDetailActor | null {
  const record = exactRecord(value, ['user_id', 'nickname', 'profile_image_url']);
  if (
    record === null ||
    !isUuid(record['user_id']) ||
    typeof record['nickname'] !== 'string' ||
    !isHttpsUrl(record['profile_image_url'])
  ) return null;
  return record as unknown as PromiseDetailActor;
}

/** 서버 정규화가 끝난 두 전문에서 실제로 달라진 필드만 화면 고정 순서로 돌려준다. */
export function changedPromiseFields(
  before: ComparablePromiseContent,
  after: ComparablePromiseContent,
): PromiseAmendField[] {
  return AMEND_FIELDS.filter((field) => before[field] !== after[field]);
}

export function asPromiseAmendCreateResponse(value: unknown): PromiseAmendCreateResponse | null {
  const record = exactRecord(value, [
    'promise_id',
    'status',
    'request_id',
    'type',
    'expires_at',
  ]);
  if (
    record === null ||
    !isUuid(record['promise_id']) ||
    record['status'] !== 'AMEND_PENDING' ||
    !isUuid(record['request_id']) ||
    (record['type'] !== 'AMEND' && record['type'] !== 'CANCEL' && record['type'] !== 'FINISH') ||
    !isIsoInstant(record['expires_at'])
  ) return null;
  return record as unknown as PromiseAmendCreateResponse;
}

export function asPromiseAmendRespondResponse(value: unknown): PromiseAmendRespondResponse | null {
  const record = exactRecord(value, [
    'promise_id',
    'status',
    'request_id',
    'request_status',
    'version_no',
  ]);
  if (
    record === null ||
    !isUuid(record['promise_id']) ||
    (record['status'] !== 'ACTIVE' && record['status'] !== 'CANCELED' &&
      record['status'] !== 'CHECKING') ||
    !isUuid(record['request_id']) ||
    (record['request_status'] !== 'APPROVED' && record['request_status'] !== 'DECLINED') ||
    (record['version_no'] !== null &&
      (!Number.isInteger(record['version_no']) || (record['version_no'] as number) < 2)) ||
    (record['status'] === 'CANCELED' &&
      (record['request_status'] !== 'APPROVED' || record['version_no'] !== null)) ||
    (record['status'] === 'CHECKING' &&
      (record['request_status'] !== 'APPROVED' || record['version_no'] !== null)) ||
    (record['status'] === 'ACTIVE' &&
      record['request_status'] === 'APPROVED' &&
      record['version_no'] === null) ||
    (record['request_status'] === 'DECLINED' &&
      (record['status'] !== 'ACTIVE' || record['version_no'] !== null))
  ) return null;
  return record as unknown as PromiseAmendRespondResponse;
}

export function asPromiseAmendWithdrawResponse(value: unknown): PromiseAmendWithdrawResponse | null {
  const record = exactRecord(value, [
    'promise_id',
    'status',
    'request_id',
    'request_status',
  ]);
  if (
    record === null ||
    !isUuid(record['promise_id']) ||
    record['status'] !== 'ACTIVE' ||
    !isUuid(record['request_id']) ||
    record['request_status'] !== 'WITHDRAWN'
  ) return null;
  return record as unknown as PromiseAmendWithdrawResponse;
}

export function asPromiseVersionListResponse(value: unknown): PromiseVersionListResponse | null {
  const record = exactRecord(value, ['promise_id', 'versions']);
  if (record === null || !isUuid(record['promise_id']) || !Array.isArray(record['versions'])) {
    return null;
  }
  let previousVersionNo = Number.POSITIVE_INFINITY;
  for (const item of record['versions']) {
    const row = exactRecord(item, [
      'version',
      'change_requester',
      'approved_by',
      'approved_at',
      'change_reason',
    ]);
    if (row === null) return null;
    const version = asPromiseDetailVersion(row['version']);
    const requester = row['change_requester'] === null ? null : asActor(row['change_requester']);
    const approver = row['approved_by'] === null ? null : asActor(row['approved_by']);
    if (
      version === null ||
      version.activated_at === null ||
      version.version_no >= previousVersionNo ||
      (row['change_requester'] !== null && requester === null) ||
      (row['approved_by'] !== null && approver === null) ||
      (row['approved_at'] !== null && !isIsoInstant(row['approved_at'])) ||
      (row['change_reason'] !== null && typeof row['change_reason'] !== 'string')
    ) return null;
    previousVersionNo = version.version_no;
  }
  return record as unknown as PromiseVersionListResponse;
}
