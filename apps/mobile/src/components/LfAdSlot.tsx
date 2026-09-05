import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAdsConsentSnapshot } from '../lib/ads-consent-native.ts';

import {
  destroyNativeAd,
  loadNativeAd,
  NativeAdCard,
  type LittlefingerNativeAd,
} from '../lib/admob-native.tsx';

export interface LfAdSlotProps {
  enabled: boolean;
}

export function LfAdSlot({ enabled }: LfAdSlotProps): React.JSX.Element | null {
  const consent = useAdsConsentSnapshot();
  if (!enabled || consent.suspended) return null;
  return <ReadyAdSlot key={consent.revision} />;
}

function ReadyAdSlot(): React.JSX.Element | null {
  const [ad, setAd] = useState<LittlefingerNativeAd | null>(null);

  useEffect(() => {
    let active = true;
    let loaded: LittlefingerNativeAd | null = null;
    void loadNativeAd()
      .then((value) => {
        if (value === null) return;
        loaded = value;
        if (active) setAd(value);
        else destroyNativeAd(value);
      })
      .catch(() => {
        // 광고 실패는 홈 콘텐츠와 독립이며 빈 공간도 남기지 않는다.
      });

    return () => {
      active = false;
      if (loaded !== null) destroyNativeAd(loaded);
    };
  }, []);

  if (ad === null) return null;

  return (
    <View testID="lf-ad-slot">
      <NativeAdCard ad={ad} />
    </View>
  );
}
