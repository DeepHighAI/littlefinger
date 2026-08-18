import type { PostgrestSingleResponse } from 'npm:@supabase/supabase-js@2';

import { createAdminClient, createDeps, requireEnv } from '../_shared/runtime.ts';
import type { AccountWithdrawDeps } from './handler.ts';

export function createAccountWithdrawDeps(): AccountWithdrawDeps {
  const base = createDeps();
  const admin = createAdminClient();
  return {
    ...base,
    accountIdPepper: requireEnv('ACCOUNT_ID_PEPPER'),
    accountIdentifier: async (actor) => {
      const result = await admin.from('users').select('kakao_id').eq('id', actor).single() as PostgrestSingleResponse<{ kakao_id: string }>;
      if (result.error !== null || typeof result.data?.kakao_id !== 'string') {
        throw new Error('ACCOUNT_IDENTIFIER_NOT_FOUND');
      }
      return result.data.kakao_id;
    },
    deleteAuthUser: async (actor) => {
      const { error } = await admin.auth.admin.deleteUser(actor);
      if (error !== null) throw error;
    },
  };
}
