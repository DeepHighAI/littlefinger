export interface NativeAdLoaderDeps<T> {
  gatherConsent(): Promise<unknown>;
  getConsentInfo(): Promise<{ canRequestAds: boolean }>;
  initialize(): Promise<unknown>;
  createAd(unitId: string): Promise<T>;
}

export function createNativeAdLoader<T>(deps: NativeAdLoaderDeps<T>) {
  let initialization: Promise<unknown> | null = null;

  return async function load(unitId: string): Promise<T | null> {
    await deps.gatherConsent();
    const consent = await deps.getConsentInfo();
    if (!consent.canRequestAds) return null;

    initialization ??= deps.initialize();
    await initialization;
    return await deps.createAd(unitId);
  };
}
