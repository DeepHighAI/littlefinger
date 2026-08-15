import type { PromiseDetailRequest } from '../../../packages/shared/src/api.ts';
import { ApiError } from './errors.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function promiseDetailRequestOf(body: Record<string, unknown>): PromiseDetailRequest {
  const keys = Object.keys(body);
  if (
    keys.length !== 1 ||
    keys[0] !== 'promise_id' ||
    typeof body['promise_id'] !== 'string' ||
    !UUID_PATTERN.test(body['promise_id'])
  ) {
    throw new ApiError('E_VALIDATION', { field: 'promise_id' });
  }
  return { promise_id: body['promise_id'] };
}
