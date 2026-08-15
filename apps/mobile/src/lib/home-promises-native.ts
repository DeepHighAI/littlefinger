import type {
  PromiseHomeListRequest,
  PromiseHomeListResponse,
  PromiseStatus,
} from '@littlefinger/shared';

import { listHomePromises as listHomePromisesWith } from './home-promises-api.ts';
import { callMobileFunctionNative } from './mobile-api-native.ts';
import { getMobileSupabaseClient } from './supabase-native.ts';

const deps = { call: callMobileFunctionNative };

export interface WaitingPromiseSummary {
  id: string;
  status: Extract<PromiseStatus, 'DRAFT' | 'PENDING'>;
  title: string;
  updated_at: string;
}

export async function listWaitingPromises(): Promise<WaitingPromiseSummary[]> {
  const { data, error } = await getMobileSupabaseClient()
    .from('promises')
    .select('id,status,title,updated_at')
    .in('status', ['DRAFT', 'PENDING'])
    .order('updated_at', { ascending: false });

  if (error !== null) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    status: row.status as WaitingPromiseSummary['status'],
    title: String(row.title),
    updated_at: String(row.updated_at),
  }));
}

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
