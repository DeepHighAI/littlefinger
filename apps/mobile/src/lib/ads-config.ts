import { ADS_ENABLED_DEFAULT } from '@littlefinger/shared';

export interface AdsConfigReadResult {
  data: { value: unknown } | null;
  error: unknown | null;
}

export interface AdsConfigDeps {
  read(key: 'ads_enabled'): Promise<AdsConfigReadResult>;
}

export function adsEnabledFrom(value: unknown): boolean {
  return typeof value === 'boolean' ? value : ADS_ENABLED_DEFAULT;
}

export async function loadAdsEnabled(deps: AdsConfigDeps): Promise<boolean> {
  try {
    const result = await deps.read('ads_enabled');
    if (result.error !== null || result.data === null) return ADS_ENABLED_DEFAULT;
    return adsEnabledFrom(result.data.value);
  } catch {
    // 홈 진입을 막는 것보다 광고를 끄는 쪽이 안전하다.
    return ADS_ENABLED_DEFAULT;
  }
}
