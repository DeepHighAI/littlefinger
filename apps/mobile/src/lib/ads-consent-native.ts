import { useSyncExternalStore } from 'react';
import { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } from 'react-native-google-mobile-ads';

let snapshot = { revision: 0, suspended: false };
const listeners = new Set<() => void>();
let queue: Promise<unknown> = Promise.resolve();
let privacyForm: Promise<void> | null = null;

// UMP 정보 갱신과 두 종류의 동의 창이 서로 겹치지 않도록 SDK 호출을 직렬화한다.
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch(() => undefined);
  return result;
}

export function subscribeAdsConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getAdsConsentSnapshot(): typeof snapshot {
  return snapshot;
}

function publish(suspended: boolean): void {
  snapshot = { revision: snapshot.revision + 1, suspended };
  for (const listener of listeners) listener();
}

export function useAdsConsentSnapshot(): typeof snapshot {
  return useSyncExternalStore(subscribeAdsConsent, getAdsConsentSnapshot);
}

export async function gatherAdsConsent(): Promise<void> {
  await serialize(async () => { await AdsConsent.gatherConsent(); });
}

export async function privacyOptionsRequired(): Promise<boolean> {
  return await serialize(async () => {
    let info;
    try {
      info = await AdsConsent.requestInfoUpdate();
    } catch {
      // 오프라인에서도 이전에 필요하다고 확인된 개인정보 설정 진입점은 유지한다.
      info = await AdsConsent.getConsentInfo();
    }
    return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  });
}

export function showAdsPrivacyOptions(): Promise<void> {
  if (privacyForm !== null) return privacyForm;
  // 새 선택 이전에 로드한 광고와 진행 중인 요청을 즉시 무효화한다.
  publish(true);
  privacyForm = serialize(async () => { await AdsConsent.showPrivacyOptionsForm(); })
    .finally(() => {
      privacyForm = null;
      publish(false);
    });
  return privacyForm;
}
