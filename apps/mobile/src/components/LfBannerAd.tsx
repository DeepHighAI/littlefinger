import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdaptiveBanner, ensureAdsReady } from '../lib/admob-native.tsx';
import { useAdsConsentSnapshot } from '../lib/ads-consent-native.ts';

export function LfBannerAd({ enabled }: { enabled: boolean }): React.JSX.Element | null {
  const consent = useAdsConsentSnapshot();
  if (!enabled || consent.suspended) return null;
  return <ReadyBanner key={consent.revision} />;
}

function ReadyBanner(): React.JSX.Element | null {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // 배너도 동의 관문을 지난 뒤에만 SDK 뷰를 올린다. 관문이 닫히면 빈 자리조차 남기지 않는다.
  useEffect(() => {
    let active = true;
    ensureAdsReady()
      .then((ok) => {
        if (!active) return;
        if (ok) setReady(true);
        else setFailed(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => { active = false; };
  }, []);

  if (failed || !ready) return null;
  return (
    <View testID="lf-banner-ad" style={loaded ? undefined : styles.hidden}>
      <AdaptiveBanner onLoaded={() => setLoaded(true)} onFailed={() => setFailed(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { height: 0, overflow: 'hidden' },
});
