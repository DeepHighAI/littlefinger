import type { RewardAction } from '../../../packages/shared/src/api.ts';
import { ApiError } from './errors.ts';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ACTIONS: readonly RewardAction[] = [
  'WITNESS_CREATOR',
  'WITNESS_PARTNER',
  'DURATION_30D',
  'RETENTION_30D',
];

export function uuidField(
  body: Record<string, unknown>,
  key: 'promise_id' | 'intent_id',
): string {
  const value = body[key];
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError('E_VALIDATION', { field: key });
  }
  return value;
}

export function rewardActionOf(body: Record<string, unknown>): RewardAction {
  const value = body['action'];
  if (!ACTIONS.includes(value as RewardAction)) {
    throw new ApiError('E_VALIDATION', { field: 'action' });
  }
  return value as RewardAction;
}
