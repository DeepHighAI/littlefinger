import type { ApiValidationField, SafetyReportReason } from '../../../packages/shared/src/api.ts';
import { ApiError } from './errors.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REPORT_REASONS = new Set<SafetyReportReason>([
  'ABUSE',
  'SPAM',
  'IMPERSONATION',
  'WRONG_PARTNER',
  'ETC',
]);

function exact(body: Record<string, unknown>, fields: readonly string[], field: ApiValidationField): void {
  const keys = Object.keys(body);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new ApiError('E_VALIDATION', { field });
  }
}

function uuid(value: unknown, field: ApiValidationField): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError('E_VALIDATION', { field });
  }
  return value;
}

function optionalUuid(value: unknown, field: ApiValidationField): string | null {
  return value === null ? null : uuid(value, field);
}

export function emptyAccountBody(body: Record<string, unknown>): void {
  exact(body, [], 'nickname');
}

export function nicknameOf(body: Record<string, unknown>): string {
  exact(body, ['nickname'], 'nickname');
  if (typeof body['nickname'] !== 'string') throw new ApiError('E_VALIDATION', { field: 'nickname' });
  return body['nickname'];
}

export function promiseHideOf(body: Record<string, unknown>): { promiseId: string; hidden: boolean } {
  exact(body, ['promise_id', 'hidden'], 'promise_id');
  const hidden = body['hidden'];
  if (typeof hidden !== 'boolean') throw new ApiError('E_VALIDATION', { field: 'hidden' });
  return { promiseId: uuid(body['promise_id'], 'promise_id'), hidden };
}

export function blockTargetOf(body: Record<string, unknown>): string {
  exact(body, ['target_user_id'], 'target_user_id');
  return uuid(body['target_user_id'], 'target_user_id');
}

export function emptyBlockListBody(body: Record<string, unknown>): void {
  exact(body, [], 'target_user_id');
}

export function safetyReportOf(body: Record<string, unknown>): {
  promiseId: string;
  targetUserId: string | null;
  evidenceId: string | null;
  reason: SafetyReportReason;
  detail: string | null;
} {
  exact(body, ['promise_id', 'target_user_id', 'evidence_id', 'reason', 'detail'], 'reason');
  const reason = body['reason'];
  const detail = body['detail'];
  if (typeof reason !== 'string' || !REPORT_REASONS.has(reason as SafetyReportReason)) {
    throw new ApiError('E_VALIDATION', { field: 'reason' });
  }
  if (detail !== null && typeof detail !== 'string') {
    throw new ApiError('E_VALIDATION', { field: 'detail' });
  }
  return {
    promiseId: uuid(body['promise_id'], 'promise_id'),
    targetUserId: optionalUuid(body['target_user_id'], 'target_user_id'),
    evidenceId: optionalUuid(body['evidence_id'], 'evidence_id'),
    reason: reason as SafetyReportReason,
    detail,
  };
}
