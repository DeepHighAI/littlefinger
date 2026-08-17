import { createNativeAdLoader } from './admob-loader.ts';

function gateway(input: { canRequestAds: boolean }) {
  return {
    gatherConsent: jest.fn().mockResolvedValue(undefined),
    getConsentInfo: jest.fn().mockResolvedValue({ canRequestAds: input.canRequestAds }),
    initialize: jest.fn().mockResolvedValue(undefined),
    createAd: jest.fn().mockResolvedValue('native-ad'),
  };
}

describe('consent-aware native ad loading', () => {
  test('gathers current consent before initialization and ad creation', async () => {
    const deps = gateway({ canRequestAds: true });
    const load = createNativeAdLoader(deps);

    await expect(load('unit-id')).resolves.toBe('native-ad');
    expect(deps.gatherConsent).toHaveBeenCalledTimes(1);
    expect(deps.getConsentInfo).toHaveBeenCalledTimes(1);
    expect(deps.initialize).toHaveBeenCalledTimes(1);
    expect(deps.createAd).toHaveBeenCalledWith('unit-id');
    expect(deps.gatherConsent.mock.invocationCallOrder[0]).toBeLessThan(
      deps.initialize.mock.invocationCallOrder[0] ?? 0,
    );
    expect(deps.initialize.mock.invocationCallOrder[0]).toBeLessThan(
      deps.createAd.mock.invocationCallOrder[0] ?? 0,
    );
  });

  test('does not initialize or request an ad when consent cannot request ads', async () => {
    const deps = gateway({ canRequestAds: false });
    const load = createNativeAdLoader(deps);

    await expect(load('unit-id')).resolves.toBeNull();
    expect(deps.initialize).not.toHaveBeenCalled();
    expect(deps.createAd).not.toHaveBeenCalled();
  });

  test('initializes the SDK at most once across slot remounts', async () => {
    const deps = gateway({ canRequestAds: true });
    const load = createNativeAdLoader(deps);

    await load('unit-id');
    await load('unit-id');
    expect(deps.gatherConsent).toHaveBeenCalledTimes(2);
    expect(deps.initialize).toHaveBeenCalledTimes(1);
    expect(deps.createAd).toHaveBeenCalledTimes(2);
  });
});
