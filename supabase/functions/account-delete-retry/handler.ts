import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';

interface AuthDeletionItem {
  user_id: string;
  lease_id: string;
}

export interface AccountDeleteRetryDeps extends Pick<Deps, 'rpc' | 'log' | 'now'> {
  retrySecret: string;
  deleteAuthUser: (userId: string) => Promise<void>;
}

function secretsMatch(actual: string | null, expected: string): boolean {
  if (actual === null || actual.length !== expected.length || expected.length === 0) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function claimedItems(value: unknown): AuthDeletionItem[] {
  if (typeof value !== 'object' || value === null) throw new Error('INVALID_AUTH_DELETE_CLAIM');
  const items = (value as Record<string, unknown>)['items'];
  if (!Array.isArray(items)) throw new Error('INVALID_AUTH_DELETE_CLAIM');
  return items.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('INVALID_AUTH_DELETE_CLAIM');
    const row = item as Record<string, unknown>;
    if (typeof row['user_id'] !== 'string' || typeof row['lease_id'] !== 'string') {
      throw new Error('INVALID_AUTH_DELETE_CLAIM');
    }
    return { user_id: row['user_id'], lease_id: row['lease_id'] };
  });
}

export function createAccountDeleteRetryHandler(deps: AccountDeleteRetryDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (
        request.method !== 'POST' ||
        !secretsMatch(
          request.headers.get('x-account-delete-retry-secret'),
          deps.retrySecret,
        )
      ) {
        throw new ApiError('E_AUTH_REQUIRED');
      }

      const now = deps.now().toISOString();
      const items = claimedItems(await deps.rpc('lf_auth_deletion_claim', {
        p_now: now,
        p_limit: 50,
      }));
      let deletedCount = 0;
      let retryCount = 0;

      for (const item of items) {
        try {
          await deps.deleteAuthUser(item.user_id);
          const completed = await deps.rpc('lf_auth_deletion_complete', {
            p_user_id: item.user_id,
            p_lease_id: item.lease_id,
          });
          if (completed !== true) throw new Error('AUTH_DELETE_LEASE_LOST');
          deletedCount += 1;
        } catch (raised) {
          const reason = raised instanceof Error ? raised.message : 'UNKNOWN';
          await deps.rpc('lf_auth_deletion_retry', {
            p_user_id: item.user_id,
            p_lease_id: item.lease_id,
            p_error: reason,
            p_now: now,
          });
          retryCount += 1;
        }
      }

      return jsonResponse(
        { claimed_count: items.length, deleted_count: deletedCount, retry_count: retryCount },
        200,
      );
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
