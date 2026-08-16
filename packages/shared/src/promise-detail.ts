import type {
  EvidenceView,
  FulfillmentCheckView,
  FulfillmentRoundView,
  PromiseDetailActor,
  PromiseDetailAmendRequest,
  PromiseDetailApproval,
  PromiseDetailFulfillment,
  PromiseDetailInvitation,
  PromiseDetailPerson,
  PromiseDetailResponse,
  PromiseDetailStatus,
  PromiseDetailVersion,
} from './api.ts';
import { isIsoInstant } from './datetime.ts';
import {
  PROMISE_STATUSES,
  type ParticipantRole,
  type PromiseCategory,
  type Keeper,
} from './promise.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const FINGERPRINT_PATTERN = /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{2}$/u;
const DETAIL_STATUSES = PROMISE_STATUSES.filter(
  (status): status is PromiseDetailStatus => status !== 'DRAFT',
);
const ROLES = ['CREATOR', 'PARTNER', 'WITNESS'] as const;
const PARTICIPANT_STATUSES = ['INVITED', 'JOINED', 'DECLINED', 'WITHDRAWN'] as const;
const CATEGORIES = ['HABIT', 'BET', 'MONEY', 'ETC'] as const;
const KEEPERS = ['CREATOR', 'PARTNER', 'BOTH'] as const;
const APPROVAL_ACTIONS = [
  'APPROVE',
  'DECLINE',
  'AMEND_SUGGEST',
  'AMEND_REQUEST',
  'AMEND_APPROVE',
  'AMEND_DECLINE',
  'AMEND_WITHDRAW',
  'CANCEL_REQUEST',
  'CANCEL_APPROVE',
  'CANCEL_DECLINE',
  'WITNESS_SIGN',
] as const;
const INVITATION_STATUSES = ['PENDING', 'USED', 'EXPIRED', 'REVOKED'] as const;
const AMEND_TYPES = ['AMEND', 'CANCEL'] as const;
const AMEND_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'] as const;
const FULFILLMENT_STATUSES: readonly PromiseDetailStatus[] = [
  'CHECKING',
  'COMPLETED',
  'BROKEN',
  'DISPUTED',
  'UNRESOLVED',
];
const CONFIRMED_STATUSES: readonly PromiseDetailStatus[] = [
  'ACTIVE',
  'AMEND_PENDING',
  'CHECKING',
  'COMPLETED',
  'BROKEN',
  'DISPUTED',
  'UNRESOLVED',
  'CANCELED',
];

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

function isNullableInstant(value: unknown): value is string | null {
  return value === null || isIsoInstant(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
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

function asPerson(value: unknown): PromiseDetailPerson | null {
  const record = exactRecord(value, [
    'user_id',
    'nickname',
    'profile_image_url',
    'role',
    'status',
    'joined_at',
  ]);
  if (
    record === null ||
    !isUuid(record['user_id']) ||
    typeof record['nickname'] !== 'string' ||
    !isHttpsUrl(record['profile_image_url']) ||
    !ROLES.includes(record['role'] as ParticipantRole) ||
    !PARTICIPANT_STATUSES.includes(
      record['status'] as (typeof PARTICIPANT_STATUSES)[number],
    ) ||
    !isNullableInstant(record['joined_at'])
  ) return null;
  return record as unknown as PromiseDetailPerson;
}

export function asPromiseDetailVersion(value: unknown): PromiseDetailVersion | null {
  const record = exactRecord(value, [
    'version_no',
    'title',
    'body',
    'category',
    'end_date',
    'keeper',
    'reward',
    'penalty',
    'content_hash',
    'fingerprint',
    'activated_at',
    'superseded_at',
    'change_reason',
  ]);
  if (
    record === null ||
    !Number.isInteger(record['version_no']) ||
    (record['version_no'] as number) < 1 ||
    typeof record['title'] !== 'string' ||
    typeof record['body'] !== 'string' ||
    !CATEGORIES.includes(record['category'] as PromiseCategory) ||
    !isIsoDate(record['end_date']) ||
    !KEEPERS.includes(record['keeper'] as Keeper) ||
    !isNullableString(record['reward']) ||
    !isNullableString(record['penalty']) ||
    typeof record['content_hash'] !== 'string' ||
    !HASH_PATTERN.test(record['content_hash']) ||
    typeof record['fingerprint'] !== 'string' ||
    !FINGERPRINT_PATTERN.test(record['fingerprint']) ||
    !isNullableInstant(record['activated_at']) ||
    !isNullableInstant(record['superseded_at']) ||
    !isNullableString(record['change_reason'])
  ) return null;
  return record as unknown as PromiseDetailVersion;
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
    record === null ||
    !isUuid(record['evidence_id']) ||
    record['mime'] !== 'image/jpeg' ||
    !Number.isInteger(record['bytes']) ||
    (record['bytes'] as number) < 1 ||
    !Number.isInteger(record['width']) ||
    (record['width'] as number) < 1 ||
    !Number.isInteger(record['height']) ||
    (record['height'] as number) < 1 ||
    !['AVAILABLE', 'BLINDED', 'EXPIRED'].includes(record['availability'] as string)
  ) return null;
  return record as unknown as EvidenceView;
}

function asCheck(value: unknown): FulfillmentCheckView | null {
  const record = exactRecord(value, [
    'role',
    'answer',
    'comment',
    'submitted_at',
    'revised_at',
    'round_no',
    'evidences',
  ]);
  if (
    record === null ||
    (record['role'] !== 'CREATOR' && record['role'] !== 'PARTNER') ||
    (record['answer'] !== 'KEPT' && record['answer'] !== 'NOT_KEPT') ||
    !isNullableString(record['comment']) ||
    !isIsoInstant(record['submitted_at']) ||
    !isNullableInstant(record['revised_at']) ||
    !Number.isInteger(record['round_no']) ||
    (record['round_no'] as number) < 1 ||
    !Array.isArray(record['evidences']) ||
    record['evidences'].some((item) => asEvidence(item) === null)
  ) return null;
  return record as unknown as FulfillmentCheckView;
}

function asRound(value: unknown): FulfillmentRoundView | null {
  const record = exactRecord(value, ['round_no', 'creator_check', 'partner_check']);
  if (
    record === null ||
    !Number.isInteger(record['round_no']) ||
    (record['round_no'] as number) < 1
  ) return null;
  const creator = record['creator_check'] === null ? null : asCheck(record['creator_check']);
  const partner = record['partner_check'] === null ? null : asCheck(record['partner_check']);
  if (
    (record['creator_check'] !== null && (creator === null || creator.role !== 'CREATOR')) ||
    (record['partner_check'] !== null && (partner === null || partner.role !== 'PARTNER')) ||
    (creator !== null && creator.round_no !== record['round_no']) ||
    (partner !== null && partner.round_no !== record['round_no'])
  ) return null;
  return record as unknown as FulfillmentRoundView;
}

function asApproval(value: unknown): PromiseDetailApproval | null {
  const record = exactRecord(value, ['role', 'action', 'actor', 'acted_at', 'comment']);
  if (
    record === null ||
    !ROLES.includes(record['role'] as ParticipantRole) ||
    !APPROVAL_ACTIONS.includes(record['action'] as (typeof APPROVAL_ACTIONS)[number]) ||
    asActor(record['actor']) === null ||
    !isIsoInstant(record['acted_at']) ||
    !isNullableString(record['comment'])
  ) return null;
  return record as unknown as PromiseDetailApproval;
}

function asInvitation(value: unknown): PromiseDetailInvitation | null {
  const record = exactRecord(value, ['status', 'expires_at', 'resend_count']);
  if (
    record === null ||
    !INVITATION_STATUSES.includes(
      record['status'] as (typeof INVITATION_STATUSES)[number],
    ) ||
    !isIsoInstant(record['expires_at']) ||
    !Number.isInteger(record['resend_count']) ||
    (record['resend_count'] as number) < 0
  ) return null;
  return record as unknown as PromiseDetailInvitation;
}

function asAmendRequest(value: unknown): PromiseDetailAmendRequest | null {
  const record = exactRecord(value, [
    'request_id',
    'type',
    'status',
    'requester',
    'reason',
    'created_at',
    'expires_at',
    'proposed_version',
  ]);
  if (
    record === null ||
    !isUuid(record['request_id']) ||
    !AMEND_TYPES.includes(record['type'] as (typeof AMEND_TYPES)[number]) ||
    !AMEND_STATUSES.includes(record['status'] as (typeof AMEND_STATUSES)[number]) ||
    asActor(record['requester']) === null ||
    !isNullableString(record['reason']) ||
    !isIsoInstant(record['created_at']) ||
    !isIsoInstant(record['expires_at'])
  ) return null;
  const proposed =
    record['proposed_version'] === null
      ? null
      : asPromiseDetailVersion(record['proposed_version']);
  if (
    (record['proposed_version'] !== null && proposed === null) ||
    (record['type'] === 'AMEND' && proposed === null) ||
    (record['type'] === 'CANCEL' && proposed !== null)
  ) return null;
  return record as unknown as PromiseDetailAmendRequest;
}

function asFulfillment(value: unknown): PromiseDetailFulfillment | null {
  const record = exactRecord(value, [
    'round_no',
    'creator_has_submitted',
    'partner_has_submitted',
    'creator_check',
    'partner_check',
    'history',
  ]);
  if (
    record === null ||
    !Number.isInteger(record['round_no']) ||
    (record['round_no'] as number) < 1 ||
    typeof record['creator_has_submitted'] !== 'boolean' ||
    typeof record['partner_has_submitted'] !== 'boolean' ||
    !Array.isArray(record['history']) ||
    record['history'].some((item) => asRound(item) === null)
  ) return null;
  const creator = record['creator_check'] === null ? null : asCheck(record['creator_check']);
  const partner = record['partner_check'] === null ? null : asCheck(record['partner_check']);
  if (
    (record['creator_check'] !== null && (creator === null || creator.role !== 'CREATOR')) ||
    (record['partner_check'] !== null && (partner === null || partner.role !== 'PARTNER')) ||
    (creator !== null && creator.round_no !== record['round_no']) ||
    (partner !== null && partner.round_no !== record['round_no'])
  ) return null;
  return record as unknown as PromiseDetailFulfillment;
}

function hasExpectedOutcome(
  status: PromiseDetailStatus,
  fulfillment: PromiseDetailFulfillment | null,
): boolean {
  if (!FULFILLMENT_STATUSES.includes(status)) return fulfillment === null;
  if (fulfillment === null) return false;
  const creator = fulfillment.creator_check;
  const partner = fulfillment.partner_check;
  if (status === 'CHECKING') return true;
  if (status === 'COMPLETED') {
    return creator?.answer === 'KEPT' && partner?.answer === 'KEPT';
  }
  if (status === 'BROKEN') {
    return creator?.answer === 'NOT_KEPT' && partner?.answer === 'NOT_KEPT';
  }
  if (status === 'DISPUTED') {
    return creator !== null && partner !== null && creator.answer !== partner.answer;
  }
  return creator === null || partner === null;
}

export function asPromiseDetailResponse(value: unknown): PromiseDetailResponse | null {
  const record = exactRecord(value, [
    'promise_id',
    'status',
    'title',
    'body',
    'category',
    'end_date',
    'keeper',
    'reward',
    'penalty',
    'witness_enabled',
    'activated_at',
    'closed_at',
    'checking_started_at',
    'check_deadline_at',
    'check_round_no',
    'my_role',
    'creator',
    'partner',
    'witnesses',
    'approvals',
    'current_version',
    'invitation',
    'amend_request',
    'fulfillment',
  ]);
  if (record === null) return null;
  const status = record['status'] as PromiseDetailStatus;
  const creator = asPerson(record['creator']);
  const partner = record['partner'] === null ? null : asPerson(record['partner']);
  const version = asPromiseDetailVersion(record['current_version']);
  const invitation = record['invitation'] === null ? null : asInvitation(record['invitation']);
  const amend = record['amend_request'] === null ? null : asAmendRequest(record['amend_request']);
  const fulfillment =
    record['fulfillment'] === null ? null : asFulfillment(record['fulfillment']);
  if (
    !isUuid(record['promise_id']) ||
    !DETAIL_STATUSES.includes(status) ||
    typeof record['title'] !== 'string' ||
    typeof record['body'] !== 'string' ||
    !CATEGORIES.includes(record['category'] as PromiseCategory) ||
    !isIsoDate(record['end_date']) ||
    !KEEPERS.includes(record['keeper'] as Keeper) ||
    !isNullableString(record['reward']) ||
    !isNullableString(record['penalty']) ||
    typeof record['witness_enabled'] !== 'boolean' ||
    !isNullableInstant(record['activated_at']) ||
    !isNullableInstant(record['closed_at']) ||
    !isNullableInstant(record['checking_started_at']) ||
    !isNullableInstant(record['check_deadline_at']) ||
    !Number.isInteger(record['check_round_no']) ||
    (record['check_round_no'] as number) < 1 ||
    !ROLES.includes(record['my_role'] as ParticipantRole) ||
    creator === null ||
    creator.role !== 'CREATOR' ||
    (record['partner'] !== null && (partner === null || partner.role !== 'PARTNER')) ||
    !Array.isArray(record['witnesses']) ||
    record['witnesses'].some((item) => asPerson(item)?.role !== 'WITNESS') ||
    !Array.isArray(record['approvals']) ||
    record['approvals'].some((item) => asApproval(item) === null) ||
    version === null ||
    (record['invitation'] !== null && invitation === null) ||
    (record['amend_request'] !== null && amend === null) ||
    (record['fulfillment'] !== null && fulfillment === null)
  ) return null;
  if (
    version.title !== record['title'] ||
    version.body !== record['body'] ||
    version.category !== record['category'] ||
    version.end_date !== record['end_date'] ||
    version.keeper !== record['keeper'] ||
    version.reward !== record['reward'] ||
    version.penalty !== record['penalty']
  ) return null;
  if (
    status === 'PENDING' &&
    (invitation === null ||
      record['activated_at'] !== null ||
      partner !== null ||
      record['approvals'].length !== 0)
  ) return null;
  if (status === 'DECLINED' && record['activated_at'] !== null) return null;
  if (
    CONFIRMED_STATUSES.includes(status) &&
    !isIsoInstant(record['activated_at'])
  ) return null;
  if ((status === 'PENDING') !== (invitation !== null)) return null;
  if (
    status === 'AMEND_PENDING' &&
    (amend === null || amend.status !== 'PENDING')
  ) return null;
  if (
    status === 'CANCELED' &&
    (amend === null || amend.type !== 'CANCEL' || amend.status !== 'APPROVED')
  ) return null;
  if (status !== 'AMEND_PENDING' && status !== 'CANCELED' && amend !== null) return null;
  if (!hasExpectedOutcome(status, fulfillment)) return null;
  if (fulfillment !== null && fulfillment.round_no !== record['check_round_no']) return null;
  if (
    status === 'CHECKING' &&
    (!isIsoInstant(record['checking_started_at']) || !isIsoInstant(record['check_deadline_at']))
  ) return null;
  if (
    ['COMPLETED', 'BROKEN', 'UNRESOLVED', 'DECLINED', 'CANCELED'].includes(status) &&
    !isIsoInstant(record['closed_at'])
  ) return null;
  return record as unknown as PromiseDetailResponse;
}
