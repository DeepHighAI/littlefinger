import type {
  EvidenceView,
  WitnessDetailActor,
  WitnessDetailContent,
  WitnessDetailResponse,
  WitnessFulfillmentClaim,
  WitnessFulfillmentView,
  WitnessInviteListResponse,
  WitnessInviteResponse,
  WitnessJoinResponse,
  WitnessLeaveResponse,
  WitnessSignResponse,
  WitnessSlotView,
} from './api.ts';
import { isIsoInstant } from './datetime.ts';
import { PROMISE_STATUSES, type PromiseStatus } from './promise.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const FULL_STATUSES = new Set<PromiseStatus>([
  'ACTIVE',
  'AMEND_PENDING',
  'CHECKING',
  'COMPLETED',
  'BROKEN',
  'DISPUTED',
  'UNRESOLVED',
  'CANCELED',
]);

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

function isNullableInstant(value: unknown): value is string | null {
  return value === null || isIsoInstant(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function isProfileUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function asActor(value: unknown): WitnessDetailActor | null {
  const record = exactRecord(value, ['user_id', 'nickname', 'profile_image_url']);
  if (
    record === null
    || !isUuid(record['user_id'])
    || typeof record['nickname'] !== 'string'
    || record['nickname'].length === 0
    || !isProfileUrl(record['profile_image_url'])
  ) return null;
  return record as unknown as WitnessDetailActor;
}

function asSlot(value: unknown): WitnessSlotView | null {
  const record = exactRecord(value, [
    'participant_id',
    'status',
    'nickname',
    'profile_image_url',
    'expires_at',
    'signed_at',
  ]);
  if (record === null || !isUuid(record['participant_id'])) return null;
  if (record['status'] === 'INVITED') {
    if (
      record['nickname'] !== null
      || record['profile_image_url'] !== null
      || !isIsoInstant(record['expires_at'])
      || record['signed_at'] !== null
    ) return null;
  } else if (record['status'] === 'JOINED') {
    if (
      typeof record['nickname'] !== 'string'
      || record['nickname'].length === 0
      || !isProfileUrl(record['profile_image_url'])
      || record['expires_at'] !== null
      || !isNullableInstant(record['signed_at'])
    ) return null;
  } else {
    return null;
  }
  return record as unknown as WitnessSlotView;
}

function asContent(value: unknown): WitnessDetailContent | null {
  const record = exactRecord(value, [
    'body',
    'category',
    'end_date',
    'keeper',
    'reward',
    'penalty',
  ]);
  if (
    record === null
    || typeof record['body'] !== 'string'
    || !['HABIT', 'BET', 'MONEY', 'ETC'].includes(record['category'] as string)
    || !isIsoDate(record['end_date'])
    || !['CREATOR', 'PARTNER', 'BOTH'].includes(record['keeper'] as string)
    || (record['reward'] !== null && typeof record['reward'] !== 'string')
    || (record['penalty'] !== null && typeof record['penalty'] !== 'string')
  ) return null;
  return record as unknown as WitnessDetailContent;
}

function asEvidence(value: unknown): EvidenceView | null {
  const record = exactRecord(value, [
    'evidence_id',
    'mime',
    'bytes',
    'width',
    'height',
    'availability',
  ]);
  if (
    record === null
    || !isUuid(record['evidence_id'])
    || record['mime'] !== 'image/jpeg'
    || !Number.isInteger(record['bytes'])
    || (record['bytes'] as number) < 1
    || !Number.isInteger(record['width'])
    || (record['width'] as number) < 1
    || !Number.isInteger(record['height'])
    || (record['height'] as number) < 1
    || !['AVAILABLE', 'BLINDED', 'EXPIRED'].includes(record['availability'] as string)
  ) return null;
  return record as unknown as EvidenceView;
}

function asClaim(value: unknown): WitnessFulfillmentClaim | null {
  const record = exactRecord(value, [
    'role',
    'answer',
    'comment',
    'submitted_at',
    'evidences',
  ]);
  if (
    record === null
    || !['CREATOR', 'PARTNER'].includes(record['role'] as string)
    || !['KEPT', 'NOT_KEPT'].includes(record['answer'] as string)
    || (record['comment'] !== null && typeof record['comment'] !== 'string')
    || !isIsoInstant(record['submitted_at'])
    || !Array.isArray(record['evidences'])
  ) return null;
  const evidences = record['evidences'].map(asEvidence);
  if (evidences.some((evidence) => evidence === null)) return null;
  return record as unknown as WitnessFulfillmentClaim;
}

function asFulfillment(value: unknown): WitnessFulfillmentView | null {
  const record = exactRecord(value, ['round_no', 'claims']);
  if (
    record === null
    || !Number.isInteger(record['round_no'])
    || (record['round_no'] as number) < 1
    || !Array.isArray(record['claims'])
    || record['claims'].length > 2
  ) return null;
  const claims = record['claims'].map(asClaim);
  if (claims.some((claim) => claim === null)) return null;
  const roles = claims.map((claim) => claim?.role);
  if (new Set(roles).size !== roles.length) return null;
  return record as unknown as WitnessFulfillmentView;
}

export function asWitnessInviteListResponse(value: unknown): WitnessInviteListResponse | null {
  const record = exactRecord(value, ['promise_id', 'occupied_count', 'capacity', 'witnesses']);
  if (
    record === null
    || !isUuid(record['promise_id'])
    || record['capacity'] !== 2
    || !Number.isInteger(record['occupied_count'])
    || !Array.isArray(record['witnesses'])
    || record['witnesses'].length > 2
    || record['occupied_count'] !== record['witnesses'].length
  ) return null;
  const witnesses = record['witnesses'].map(asSlot);
  if (witnesses.some((slot) => slot === null)) return null;
  const ids = witnesses.map((slot) => slot?.participant_id);
  if (new Set(ids).size !== ids.length) return null;
  return record as unknown as WitnessInviteListResponse;
}

export function asWitnessInviteResponse(value: unknown): WitnessInviteResponse | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const hasToken = Object.prototype.hasOwnProperty.call(value, 'token');
  const record = exactRecord(value, [
    'promise_id',
    'participant_id',
    'invitation_id',
    'title',
    'expires_at',
    ...(hasToken ? ['token'] : []),
  ]);
  if (
    record === null
    || !isUuid(record['promise_id'])
    || !isUuid(record['participant_id'])
    || !isUuid(record['invitation_id'])
    || typeof record['title'] !== 'string'
    || record['title'].length === 0
    || !isIsoInstant(record['expires_at'])
    || (hasToken && (typeof record['token'] !== 'string' || !TOKEN_PATTERN.test(record['token'])))
  ) return null;
  return record as unknown as WitnessInviteResponse;
}

export function asWitnessJoinResponse(value: unknown): WitnessJoinResponse | null {
  const record = exactRecord(value, ['promise_id', 'participant_id', 'status']);
  if (
    record === null
    || !isUuid(record['promise_id'])
    || !isUuid(record['participant_id'])
    || record['status'] !== 'JOINED'
  ) return null;
  return record as unknown as WitnessJoinResponse;
}

export function asWitnessDetailResponse(value: unknown): WitnessDetailResponse | null {
  const record = exactRecord(value, [
    'promise_id',
    'status',
    'visibility',
    'title',
    'creator',
    'partner',
    'activated_at',
    'signed_at',
    'content',
    'fulfillment',
  ]);
  if (
    record === null
    || !isUuid(record['promise_id'])
    || !PROMISE_STATUSES.includes(record['status'] as PromiseStatus)
    || typeof record['title'] !== 'string'
    || record['title'].length === 0
    || asActor(record['creator']) === null
  ) return null;

  if (record['visibility'] === 'LIMITED') {
    if (
      record['partner'] !== null
      || record['activated_at'] !== null
      || record['signed_at'] !== null
      || record['content'] !== null
      || record['fulfillment'] !== null
    ) return null;
  } else if (record['visibility'] === 'FULL') {
    if (
      !FULL_STATUSES.has(record['status'] as PromiseStatus)
      || asActor(record['partner']) === null
      || !isIsoInstant(record['activated_at'])
      || !isNullableInstant(record['signed_at'])
      || asContent(record['content']) === null
      || (record['fulfillment'] !== null && asFulfillment(record['fulfillment']) === null)
    ) return null;
  } else {
    return null;
  }
  return record as unknown as WitnessDetailResponse;
}

export function asWitnessSignResponse(value: unknown): WitnessSignResponse | null {
  const record = exactRecord(value, ['promise_id', 'signed_at']);
  if (record === null || !isUuid(record['promise_id']) || !isIsoInstant(record['signed_at'])) {
    return null;
  }
  return record as unknown as WitnessSignResponse;
}

export function asWitnessLeaveResponse(value: unknown): WitnessLeaveResponse | null {
  const record = exactRecord(value, ['promise_id', 'status']);
  if (record === null || !isUuid(record['promise_id']) || record['status'] !== 'WITHDRAWN') {
    return null;
  }
  return record as unknown as WitnessLeaveResponse;
}
