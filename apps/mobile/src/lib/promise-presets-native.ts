import {
  asPromiseFeaturedPresets,
  PROMISE_PRESETS_CONFIG_KEY,
  type PromiseFeaturedPresets,
} from '@littlefinger/shared';

import { getMobileSupabaseClient } from './supabase-native.ts';

let subscriptionId = 0;

export async function readFeaturedPresets(): Promise<PromiseFeaturedPresets | null> {
  const { data, error } = await getMobileSupabaseClient()
    .from('app_configs')
    .select('value')
    .eq('key', PROMISE_PRESETS_CONFIG_KEY)
    .maybeSingle();
  if (error !== null) throw error;
  return asPromiseFeaturedPresets(data?.['value']);
}

export function subscribeFeaturedPresets(onChange: () => void): () => void {
  const client = getMobileSupabaseClient();
  // 같은 화면이 스택에 두 번 있어도 SDK가 동일 채널을 재사용하지 않게 한다.
  const channel = client.channel(`${PROMISE_PRESETS_CONFIG_KEY}-${++subscriptionId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'app_configs',
      filter: `key=eq.${PROMISE_PRESETS_CONFIG_KEY}`,
    }, onChange)
    .subscribe((status) => {
      // 첫 조회와 구독 사이 또는 연결이 끊긴 동안 놓친 변경도 다시 읽는다.
      if (status === 'SUBSCRIBED') onChange();
    });
  return () => { void client.removeChannel(channel); };
}
