import type {
  PromiseHomeListRequest,
  PromiseHomeListResponse,
} from '@littlefinger/shared';

import { listHomePromises as listHomePromisesWith } from './home-promises-api.ts';
import { callMobileFunctionNative } from './mobile-api-native.ts';
import { getMobileSupabaseClient } from './supabase-native.ts';

const deps = { call: callMobileFunctionNative };

export async function listHomePromises(
  input: PromiseHomeListRequest,
): Promise<PromiseHomeListResponse> {
  return await listHomePromisesWith(input, deps);
}

export async function deleteDraft(promiseId: string): Promise<void> {
  const { error } = await getMobileSupabaseClient()
    .from('promises')
    .delete()
    .eq('id', promiseId)
    .eq('status', 'DRAFT');

  if (error !== null) throw error;
}
