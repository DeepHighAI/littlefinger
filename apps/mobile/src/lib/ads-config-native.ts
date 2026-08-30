import { loadAdsEnabled, loadRewardedAdsEnabled } from './ads-config.ts';
import { getMobileSupabaseClient } from './supabase-native.ts';

export async function readAdsEnabled(): Promise<boolean> {
  return await loadAdsEnabled({
    async read(key) {
      const { data, error } = await getMobileSupabaseClient()
        .from('app_configs')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      return { data: data as { value: unknown } | null, error };
    },
  });
}

export async function readRewardedAdsEnabled(): Promise<boolean> {
  return await loadRewardedAdsEnabled({
    async read(key) {
      const { data, error } = await getMobileSupabaseClient()
        .from('app_configs')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      return { data: data as { value: unknown } | null, error };
    },
  });
}
