export interface AdsGateDeps {
  gatherConsent(): Promise<unknown>;
  getConsentInfo(): Promise<{ canRequestAds: boolean }>;
  initialize(): Promise<unknown>;
}

export interface NativeAdLoaderDeps<T> {
  ensureReady(): Promise<boolean>;
  createAd(unitId: string): Promise<T>;
}

/**
 * 동의 → canRequestAds → initialize 순서의 단일 관문. 배너·네이티브·보상형이 전부 이 관문을
 * 지나야 동의 없는 광고 요청이 한 경로에서도 새지 않는다. initialize 는 앱 수명 동안 한 번이다.
 */
export function createAdsGate(deps: AdsGateDeps) {
  let initialization: Promise<unknown> | null = null;
  let readiness: Promise<boolean> | null = null;

  async function prepare(): Promise<boolean> {
    await deps.gatherConsent();
    const consent = await deps.getConsentInfo();
    if (!consent.canRequestAds) return false;

    // 초기화 실패를 캐시하면 앱을 다시 켤 때까지 광고가 영구히 죽는다 — 실패한 시도만 버리고 다음 호출이 재시도한다.
    initialization ??= deps.initialize().catch((error: unknown) => {
      initialization = null;
      throw error;
    });
    await initialization;
    return true;
  }

  return function ensureReady(): Promise<boolean> {
    // 같은 프레임의 배너·보상형 요청이 동의 창을 중복해서 열지 않도록 진행 중인 확인을 공유한다.
    readiness ??= prepare().finally(() => { readiness = null; });
    return readiness;
  };
}

export function createNativeAdLoader<T>(deps: NativeAdLoaderDeps<T>) {
  return async function load(unitId: string): Promise<T | null> {
    if (!await deps.ensureReady()) return null;
    return await deps.createAd(unitId);
  };
}
