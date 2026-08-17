import type { ApiValidationField } from '../../../packages/shared/src/api.ts';
import { ApiError } from './errors.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function exactKeys(
  body: Record<string, unknown>,
  keys: readonly string[],
  field: ApiValidationField,
): void {
  const actual = Object.keys(body).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ApiError('E_VALIDATION', { field });
  }
}

function uuid(value: unknown, field: ApiValidationField): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError('E_VALIDATION', { field });
  }
  return value;
}

export function completionCelebrationPromiseIdOf(body: Record<string, unknown>): string {
  exactKeys(body, ['promise_id'], 'promise_id');
  return uuid(body['promise_id'], 'promise_id');
}

export function completionCelebrationShownInputOf(
  body: Record<string, unknown>,
): { promiseId: string; claimId: string } {
  exactKeys(body, ['promise_id', 'claim_id'], 'promise_id');
  return {
    promiseId: uuid(body['promise_id'], 'promise_id'),
    claimId: uuid(body['claim_id'], 'promise_id'),
  };
}
