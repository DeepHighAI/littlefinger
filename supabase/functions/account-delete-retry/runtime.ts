import { createAdminClient, createDeps, requireEnv } from '../_shared/runtime.ts';
import type { AccountDeleteRetryDeps } from './handler.ts';

export function createAccountDeleteRetryDeps(): AccountDeleteRetryDeps {
  const base = createDeps();
  const admin = createAdminClient();
  return {
    rpc: base.rpc,
    log: base.log,
    now: base.now,
    retrySecret: requireEnv('ACCOUNT_DELETE_RETRY_SECRET'),
    deleteAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      // 이미 삭제된 사용자는 목표 상태에 도달했다. 재시도 대상으로 되돌리지 않는다.
      if (error !== null && error.status !== 404) throw error;
    },
  };
}
