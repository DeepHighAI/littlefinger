import type {
  PromiseEntitlementsView,
  RewardIntentResponse,
  RewardStatusResponse,
} from './api.ts';
import { isIsoInstant } from './datetime.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
// reward-callback 이 SSV user_id 로 요구하는 형태(sha256 hex)와 같은 규칙이어야 클라이언트가 먼저 거른다.
const OPAQUE_USER_ID_PATTERN = /^[0-9a-f]{64}$/u;
const ROLES = ['CREATOR', 'PARTNER', 'WITNESS'] as const;
const REWARD_STATUSES = ['PENDING', 'GRANTED', 'REJECTED'] as const;

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? record
    : null;
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isNullableInstant(value: unknown): value is string | null {
  return value === null || isIsoInstant(value);
}

export function asPromiseEntitlementsView(value: unknown): PromiseEntitlementsView | null {
  const record = exactRecord(value, ['promise_id', 'my_role', 'witness', 'duration', 'retention']);
  if (record === null || typeof record['promise_id'] !== 'string' ||
    !UUID_PATTERN.test(record['promise_id']) ||
    !ROLES.includes(record['my_role'] as (typeof ROLES)[number])) return null;

  const witness = exactRecord(record['witness'], [
    'creator_capacity', 'partner_capacity', 'creator_used', 'partner_used', 'max',
  ]);
  const duration = exactRecord(record['duration'], ['ceiling_date', 'unlimited']);
  const retention = exactRecord(
    record['retention'],
    ['anchor_at', 'expires_at', 'permanent', 'renewable'],
  );
  if (
    witness === null || duration === null || retention === null ||
    !isCount(witness['creator_capacity']) || !isCount(witness['partner_capacity']) ||
    !isCount(witness['creator_used']) || !isCount(witness['partner_used']) ||
    !isCount(witness['max']) ||
    (duration['ceiling_date'] !== null &&
      (typeof duration['ceiling_date'] !== 'string' ||
        !ISO_DATE_PATTERN.test(duration['ceiling_date']))) ||
    typeof duration['unlimited'] !== 'boolean' ||
    !isNullableInstant(retention['anchor_at']) ||
    !isNullableInstant(retention['expires_at']) ||
    typeof retention['permanent'] !== 'boolean' ||
    typeof retention['renewable'] !== 'boolean'
  ) return null;
  return record as unknown as PromiseEntitlementsView;
}

export function asRewardIntentResponse(value: unknown): RewardIntentResponse | null {
  const record = exactRecord(value, ['intent_id', 'status', 'opaque_user_id', 'expires_at']);
  if (
    record === null || typeof record['intent_id'] !== 'string' ||
    !UUID_PATTERN.test(record['intent_id']) ||
    !REWARD_STATUSES.includes(record['status'] as (typeof REWARD_STATUSES)[number]) ||
    typeof record['opaque_user_id'] !== 'string' ||
    !OPAQUE_USER_ID_PATTERN.test(record['opaque_user_id']) ||
    !isIsoInstant(record['expires_at'])
  ) return null;
  return record as unknown as RewardIntentResponse;
}

export function asRewardStatusResponse(value: unknown): RewardStatusResponse | null {
  const record = exactRecord(value, ['intent_id', 'status', 'entitlements']);
  if (
    record === null || typeof record['intent_id'] !== 'string' ||
    !UUID_PATTERN.test(record['intent_id']) ||
    !REWARD_STATUSES.includes(record['status'] as (typeof REWARD_STATUSES)[number]) ||
    (record['entitlements'] !== null && asPromiseEntitlementsView(record['entitlements']) === null)
  ) return null;
  return record as unknown as RewardStatusResponse;
}
