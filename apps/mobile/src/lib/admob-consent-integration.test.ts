import { AdsConsent, NativeAd } from 'react-native-google-mobile-ads';
import * as GoogleAds from 'react-native-google-mobile-ads';
import { ensureAdsReady, loadNativeAd } from './admob-native.tsx';
import { showAdsPrivacyOptions } from './ads-consent-native.ts';

test('privacy form fences an in-flight readiness result and blocks requests until dismissed', async () => {
  const sdk = GoogleAds.default();
  const initialize = jest.spyOn(sdk, 'initialize');
  jest.spyOn(GoogleAds, 'default').mockReturnValue(sdk);
  let releaseConsent!: () => void;
  let releasePrivacy!: () => void;
  jest.mocked(AdsConsent.gatherConsent).mockImplementationOnce(() => new Promise((resolve) => {
    releaseConsent = () => resolve({ canRequestAds: true } as Awaited<ReturnType<typeof AdsConsent.gatherConsent>>);
  }));
  jest.mocked(AdsConsent.showPrivacyOptionsForm).mockImplementationOnce(() => new Promise((resolve) => {
    releasePrivacy = () => resolve({ canRequestAds: false } as Awaited<ReturnType<typeof AdsConsent.showPrivacyOptionsForm>>);
  }));
  const readiness = ensureAdsReady();
  await Promise.resolve();
  const privacy = showAdsPrivacyOptions();
  await expect(loadNativeAd()).resolves.toBeNull();
  expect(NativeAd.createForAdRequest).not.toHaveBeenCalled();
  releaseConsent();
  await expect(readiness).resolves.toBe(false);
  expect(initialize).not.toHaveBeenCalled();
  releasePrivacy();
  await privacy;
  jest.mocked(AdsConsent.getConsentInfo).mockResolvedValue({ canRequestAds: false } as Awaited<ReturnType<typeof AdsConsent.getConsentInfo>>);
  await expect(loadNativeAd()).resolves.toBeNull();
  expect(NativeAd.createForAdRequest).not.toHaveBeenCalled();
  jest.mocked(AdsConsent.getConsentInfo).mockResolvedValue({ canRequestAds: true } as Awaited<ReturnType<typeof AdsConsent.getConsentInfo>>);
  await expect(ensureAdsReady()).resolves.toBe(true);
  expect(initialize).toHaveBeenCalledTimes(1);
  jest.restoreAllMocks();
});
