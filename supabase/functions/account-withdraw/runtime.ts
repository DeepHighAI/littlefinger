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
      const { error, data } = await admin.from('users').select('provider_user_id').eq('id', actor).single() as PostgrestSingleResponse<{ provider_user_id: string }>;
      if (error !== null || typeof data?.provider_user_id !== 'string') {
        throw new Error('ACCOUNT_IDENTIFIER_NOT_FOUND');
      }
      return data.provider_user_id;
    },
    deleteAuthUser: async (actor) => {
      const { error } = await admin.auth.admin.deleteUser(actor);
      if (error !== null && error.status !== 404) throw error;
    },
    markAuthDeletionComplete: async (actor) => {
      await base.rpc('lf_auth_deletion_complete_immediate', { p_user_id: actor });
    },
  };
}
