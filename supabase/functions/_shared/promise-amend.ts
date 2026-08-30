import type {
  ApiValidationField,
  PromiseAmendProposal,
  PromiseAmendRespondRequest,
  PromiseAmendWithdrawRequest,
  PromiseVersionListRequest,
} from '../../../packages/shared/src/api.ts';
import { normalizeInput } from '../../../packages/shared/src/text.ts';
import type { ValidationResult } from '../../../packages/shared/src/validation.ts';
import {
  validateAmendReason,
  validateBody,
  validateCategory,
  validateEndDate,
  validateKeeper,
  validatePenalty,
  validateReward,
  validateTitle,
} from '../../../packages/shared/src/validation.ts';
import type { Deps } from './deps.ts';
import { ApiError } from './errors.ts';
import { piiHash } from './hash.ts';
import { clientIp, surfaceOf, userAgent } from './request.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface ParsedPromiseAmendCreateRequest {
  promise_id: string;
  type: 'AMEND' | 'CANCEL' | 'FINISH';
  proposed: PromiseAmendProposal | null;
  reason: string | null;
}

function validation(field: ApiValidationField, message?: string | null): never {
  throw new ApiError('E_VALIDATION', {
    field,
    ...(message == null ? {} : { userMessage: message }),
  });
}

function assertValid(result: ValidationResult, field: ApiValidationField): void {
  if (!result.valid) validation(field, result.message);
}

function exactKeys(
  body: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(body);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(body, key))
    && keys.every((key) => allowed.has(key));
}

function uuidOf(body: Record<string, unknown>, key: string, field: ApiValidationField): string {
  const value = body[key];
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) validation(field);
  return value;
}

function optionalNormalizedString(
  body: Record<string, unknown>,
  key: string,
  field: ApiValidationField,
): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') validation(field);
  const normalized = normalizeInput(value);
  return normalized === '' ? null : normalized;
}

function proposalOf(value: unknown, now: Date): PromiseAmendProposal {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) validation('proposed');
  const body = value as Record<string, unknown>;
  const fields = ['title', 'body', 'category', 'end_date', 'keeper', 'reward', 'penalty'] as const;
  if (!exactKeys(body, fields)) validation('proposed');

  const requiredText = (key: (typeof fields)[number]): string => {
    const raw = body[key];
    if (typeof raw !== 'string') validation(key);
    return normalizeInput(raw);
  };
  const title = requiredText('title');
  const content = requiredText('body');
  const category = requiredText('category');
  const rawEndDate = body['end_date'];
  if (rawEndDate !== null && typeof rawEndDate !== 'string') validation('end_date');
  const endDate = rawEndDate === null ? null : normalizeInput(rawEndDate);
  const keeper = requiredText('keeper');
  const reward = optionalNormalizedString(body, 'reward', 'reward');
  const penalty = optionalNormalizedString(body, 'penalty', 'penalty');

  assertValid(validateTitle(title), 'title');
  assertValid(validateBody(content), 'body');
  assertValid(validateCategory(category), 'category');
  assertValid(validateEndDate(endDate, now), 'end_date');
  assertValid(validateKeeper(keeper), 'keeper');
  assertValid(validateReward(reward ?? ''), 'reward');
  assertValid(validatePenalty(penalty ?? ''), 'penalty');

  return {
    title,
    body: content,
    category: category as PromiseAmendProposal['category'],
    end_date: endDate,
    keeper: keeper as PromiseAmendProposal['keeper'],
    reward,
    penalty,
  };
}

export function promiseAmendCreateRequestOf(
  body: Record<string, unknown>,
  now: Date,
): ParsedPromiseAmendCreateRequest {
  const type = body['type'];
  if (type !== 'AMEND' && type !== 'CANCEL' && type !== 'FINISH') validation('type');
  const required = type === 'AMEND'
    ? ['promise_id', 'type', 'proposed']
    : ['promise_id', 'type'];
  if (!exactKeys(body, required, ['reason'])) validation('proposed');
  if (body['reason'] === null) validation('reason');
  const reason = optionalNormalizedString(body, 'reason', 'reason');
  assertValid(validateAmendReason(reason ?? ''), 'reason');
  return {
    promise_id: uuidOf(body, 'promise_id', 'promise_id'),
    type,
    proposed: type === 'AMEND' ? proposalOf(body['proposed'], now) : null,
    reason,
  };
}

export function promiseAmendRespondRequestOf(
  body: Record<string, unknown>,
): PromiseAmendRespondRequest {
  if (!exactKeys(body, ['promise_id', 'request_id', 'decision'])) validation('decision');
  const decision = body['decision'];
  if (decision !== 'APPROVE' && decision !== 'DECLINE') validation('decision');
  return {
    promise_id: uuidOf(body, 'promise_id', 'promise_id'),
    request_id: uuidOf(body, 'request_id', 'request_id'),
    decision,
  };
}

export function promiseAmendWithdrawRequestOf(
  body: Record<string, unknown>,
): PromiseAmendWithdrawRequest {
  if (!exactKeys(body, ['promise_id', 'request_id'])) validation('request_id');
  return {
    promise_id: uuidOf(body, 'promise_id', 'promise_id'),
    request_id: uuidOf(body, 'request_id', 'request_id'),
  };
}

export function promiseVersionListRequestOf(
  body: Record<string, unknown>,
): PromiseVersionListRequest {
  if (!exactKeys(body, ['promise_id'])) validation('promise_id');
  return { promise_id: uuidOf(body, 'promise_id', 'promise_id') };
}

export async function amendAuditArgs(request: Request, deps: Deps): Promise<Record<string, unknown>> {
  const ip = clientIp(request);
  const ua = userAgent(request);
  return {
    p_surface: surfaceOf(request),
    p_ip_hash: ip === null ? null : await piiHash(ip, deps.secrets.piiSalt),
    p_user_agent_hash: ua === null ? null : await piiHash(ua, deps.secrets.piiSalt),
  };
}
