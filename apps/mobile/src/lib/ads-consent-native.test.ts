import { AdsConsent } from 'react-native-google-mobile-ads';
import {
  gatherAdsConsent, getAdsConsentSnapshot, privacyOptionsRequired,
  showAdsPrivacyOptions, subscribeAdsConsent,
} from './ads-consent-native.ts';

const required = { canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' };
function consentInfo(value = required): Awaited<ReturnType<typeof AdsConsent.getConsentInfo>> {
  return { status: 'OBTAINED', isConsentFormAvailable: true, ...value } as Awaited<ReturnType<typeof AdsConsent.getConsentInfo>>;
}

beforeEach(() => {
  jest.mocked(AdsConsent.requestInfoUpdate).mockReset().mockResolvedValue(consentInfo());
  jest.mocked(AdsConsent.getConsentInfo).mockReset().mockResolvedValue(consentInfo());
  jest.mocked(AdsConsent.gatherConsent).mockReset().mockResolvedValue(consentInfo());
  jest.mocked(AdsConsent.showPrivacyOptionsForm).mockReset().mockResolvedValue(consentInfo());
});

test.each(['REQUIRED', 'NOT_REQUIRED', 'UNKNOWN'])('privacy entry follows SDK requirement %s', async (status) => {
  jest.mocked(AdsConsent.requestInfoUpdate).mockResolvedValue(consentInfo({ ...required, privacyOptionsRequirementStatus: status }));
  await expect(privacyOptionsRequired()).resolves.toBe(status === 'REQUIRED');
});

test('offline refresh preserves a cached required entry', async () => {
  jest.mocked(AdsConsent.requestInfoUpdate).mockRejectedValue(new Error('offline'));
  await expect(privacyOptionsRequired()).resolves.toBe(true);
});

test('privacy form suspends immediately, shares concurrent calls and serializes behind gathering', async () => {
  let resolveGather!: (value: ReturnType<typeof consentInfo>) => void;
  jest.mocked(AdsConsent.gatherConsent).mockReturnValue(new Promise((resolve) => { resolveGather = resolve; }));
  const listener = jest.fn();
  const unsubscribe = subscribeAdsConsent(listener);
  const initial = getAdsConsentSnapshot();
  const gathering = gatherAdsConsent();
  const first = showAdsPrivacyOptions();
  expect(showAdsPrivacyOptions()).toBe(first);
  expect(getAdsConsentSnapshot().suspended).toBe(true);
  await Promise.resolve();
  expect(AdsConsent.showPrivacyOptionsForm).not.toHaveBeenCalled();
  resolveGather(consentInfo());
  await gathering;
  await first;
  expect(AdsConsent.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
  expect(getAdsConsentSnapshot()).toEqual({ revision: initial.revision + 2, suspended: false });
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
});

test('failed form releases suspension and permits retry', async () => {
  jest.mocked(AdsConsent.showPrivacyOptionsForm).mockRejectedValueOnce(new Error('unavailable'));
  await expect(showAdsPrivacyOptions()).rejects.toThrow('unavailable');
  expect(getAdsConsentSnapshot().suspended).toBe(false);
  await expect(showAdsPrivacyOptions()).resolves.toBeUndefined();
});
