import type { ApiValidationField } from '../../../packages/shared/src/api.ts';
import { ApiError } from './errors.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

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

export function witnessPromiseIdOf(body: Record<string, unknown>): string {
  exactKeys(body, ['promise_id'], 'promise_id');
  return uuid(body['promise_id'], 'promise_id');
}

export function witnessInviteInputOf(body: Record<string, unknown>): {
  promiseId: string;
  participantId: string | null;
} {
  const hasParticipant = Object.prototype.hasOwnProperty.call(body, 'participant_id');
  exactKeys(body, hasParticipant ? ['promise_id', 'participant_id'] : ['promise_id'], 'promise_id');
  const promiseId = uuid(body['promise_id'], 'promise_id');
  const participantId = hasParticipant ? uuid(body['participant_id'], 'participant_id') : null;
  return { promiseId, participantId };
}

export function witnessTokenOf(body: Record<string, unknown>): string {
  exactKeys(body, ['token'], 'token');
  const token = body['token'];
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new ApiError('E_VALIDATION', { field: 'token' });
  }
  return token;
}
