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
      // 컬럼 개명(20260820000003) 전후 어느 쪽 스키마에서도 동작해야 배포 순서가 자유롭다.
      // 마이그레이션이 원격에 적용·검증된 뒤 kakao_id 폴백을 제거한다.
      const renamed = await admin.from('users').select('provider_user_id').eq('id', actor).single() as PostgrestSingleResponse<{ provider_user_id: string }>;
      if (renamed.error === null && typeof renamed.data?.provider_user_id === 'string') {
        return renamed.data.provider_user_id;
      }
      const legacy = await admin.from('users').select('kakao_id').eq('id', actor).single() as PostgrestSingleResponse<{ kakao_id: string }>;
      if (legacy.error !== null || typeof legacy.data?.kakao_id !== 'string') {
        throw new Error('ACCOUNT_IDENTIFIER_NOT_FOUND');
      }
      return legacy.data.kakao_id;
    },
    deleteAuthUser: async (actor) => {
      const { error } = await admin.auth.admin.deleteUser(actor);
      if (error !== null) throw error;
    },
  };
}
