import type {
  AccountWithdrawResponse,
  BlockedUserItem,
  ProfileNicknameUpdateResponse,
  PromiseHideResponse,
  SafetyReportResponse,
  UserBlockListResponse,
  UserBlockResponse,
  UserUnblockResponse,
} from './api.ts';
import { codepointLength } from './text.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function recordWithFields(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.length === fields.length && keys.every((key) => fields.includes(key)) ? record : null;
}

export function asAccountWithdrawResponse(value: unknown): AccountWithdrawResponse | null {
  const record = recordWithFields(value, ['status']);
  return record?.['status'] === 'WITHDRAWN' ? { status: 'WITHDRAWN' } : null;
}

export function asProfileNicknameUpdateResponse(value: unknown): ProfileNicknameUpdateResponse | null {
  const record = recordWithFields(value, ['nickname']);
  const nickname = record?.['nickname'];
  return typeof nickname === 'string' && codepointLength(nickname) >= 1 && codepointLength(nickname) <= 40
    ? { nickname }
    : null;
}

export function asPromiseHideResponse(value: unknown): PromiseHideResponse | null {
  const record = recordWithFields(value, ['promise_id', 'hidden']);
  const promiseId = record?.['promise_id'];
  const hidden = record?.['hidden'];
  return typeof promiseId === 'string' && UUID_PATTERN.test(promiseId) && typeof hidden === 'boolean'
    ? { promise_id: promiseId, hidden }
    : null;
}

export function asUserBlockResponse(value: unknown): UserBlockResponse | null {
  const record = recordWithFields(value, ['target_user_id', 'blocked']);
  const targetUserId = record?.['target_user_id'];
  return typeof targetUserId === 'string' && UUID_PATTERN.test(targetUserId) && record?.['blocked'] === true
    ? { target_user_id: targetUserId, blocked: true }
    : null;
}

export function asUserUnblockResponse(value: unknown): UserUnblockResponse | null {
  const record = recordWithFields(value, ['target_user_id', 'blocked']);
  const targetUserId = record?.['target_user_id'];
  return typeof targetUserId === 'string' && UUID_PATTERN.test(targetUserId) && record?.['blocked'] === false
    ? { target_user_id: targetUserId, blocked: false }
    : null;
}

function asBlockedUserItem(value: unknown): BlockedUserItem | null {
  const record = recordWithFields(value, [
    'target_user_id', 'nickname', 'profile_image_url', 'blocked_at',
  ]);
  if (record === null) return null;
  const targetUserId = record['target_user_id'];
  const nickname = record['nickname'];
  const profileImageUrl = record['profile_image_url'];
  const blockedAt = record['blocked_at'];
  return typeof targetUserId === 'string' && UUID_PATTERN.test(targetUserId)
    && typeof nickname === 'string' && nickname.length > 0
    && (profileImageUrl === null || typeof profileImageUrl === 'string')
    && typeof blockedAt === 'string' && blockedAt.length > 0
    ? {
        target_user_id: targetUserId,
        nickname,
        profile_image_url: profileImageUrl,
        blocked_at: blockedAt,
      }
    : null;
}

export function asUserBlockListResponse(value: unknown): UserBlockListResponse | null {
  const record = recordWithFields(value, ['items']);
  const rawItems = record?.['items'];
  if (!Array.isArray(rawItems)) return null;
  const items = rawItems.map(asBlockedUserItem);
  return items.every((item): item is BlockedUserItem => item !== null) ? { items } : null;
}

export function asSafetyReportResponse(value: unknown): SafetyReportResponse | null {
  const record = recordWithFields(value, ['report_id', 'status', 'evidence_blinded']);
  const reportId = record?.['report_id'];
  const evidenceBlinded = record?.['evidence_blinded'];
  return typeof reportId === 'string' && UUID_PATTERN.test(reportId) && record?.['status'] === 'RECEIVED' && typeof evidenceBlinded === 'boolean'
    ? { report_id: reportId, status: 'RECEIVED', evidence_blinded: evidenceBlinded }
    : null;
}
