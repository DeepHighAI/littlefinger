import { createAdsGate, createNativeAdLoader } from './admob-loader.ts';

function gateway(input: { canRequestAds: boolean }) {
  return {
    gatherConsent: jest.fn().mockResolvedValue(undefined),
    getConsentInfo: jest.fn().mockResolvedValue({ canRequestAds: input.canRequestAds }),
    initialize: jest.fn().mockResolvedValue(undefined),
  };
}

describe('consent-aware ads gate', () => {
  test('gathers current consent before initialization', async () => {
    const deps = gateway({ canRequestAds: true });
    const ensureReady = createAdsGate(deps);

    await expect(ensureReady()).resolves.toBe(true);
    expect(deps.gatherConsent).toHaveBeenCalledTimes(1);
    expect(deps.getConsentInfo).toHaveBeenCalledTimes(1);
    expect(deps.initialize).toHaveBeenCalledTimes(1);
    expect(deps.gatherConsent.mock.invocationCallOrder[0]).toBeLessThan(
      deps.initialize.mock.invocationCallOrder[0] ?? 0,
    );
  });

  test('does not initialize when consent cannot request ads', async () => {
    const deps = gateway({ canRequestAds: false });
    const ensureReady = createAdsGate(deps);

    await expect(ensureReady()).resolves.toBe(false);
    expect(deps.initialize).not.toHaveBeenCalled();
  });

  test('initializes the SDK at most once across callers', async () => {
    const deps = gateway({ canRequestAds: true });
    const ensureReady = createAdsGate(deps);

    await ensureReady();
    await ensureReady();
    expect(deps.gatherConsent).toHaveBeenCalledTimes(2);
    expect(deps.initialize).toHaveBeenCalledTimes(1);
  });

  test('retries initialization after a failed attempt instead of caching the failure', async () => {
    const deps = gateway({ canRequestAds: true });
    deps.initialize
      .mockRejectedValueOnce(new Error('sdk boot failed'))
      .mockResolvedValueOnce(undefined);
    const ensureReady = createAdsGate(deps);

    await expect(ensureReady()).rejects.toThrow('sdk boot failed');
    await expect(ensureReady()).resolves.toBe(true);
    expect(deps.initialize).toHaveBeenCalledTimes(2);
  });
});

describe('consent-aware native ad loading', () => {
  test('creates the ad only after the gate opens', async () => {
    const deps = gateway({ canRequestAds: true });
    const createAd = jest.fn().mockResolvedValue('native-ad');
    const load = createNativeAdLoader({ ensureReady: createAdsGate(deps), createAd });

    await expect(load('unit-id')).resolves.toBe('native-ad');
    expect(createAd).toHaveBeenCalledWith('unit-id');
    expect(deps.initialize.mock.invocationCallOrder[0]).toBeLessThan(
      createAd.mock.invocationCallOrder[0] ?? 0,
    );
  });

  test('does not request an ad when the gate is closed', async () => {
    const deps = gateway({ canRequestAds: false });
    const createAd = jest.fn().mockResolvedValue('native-ad');
    const load = createNativeAdLoader({ ensureReady: createAdsGate(deps), createAd });

    await expect(load('unit-id')).resolves.toBeNull();
    expect(createAd).not.toHaveBeenCalled();
  });
});
