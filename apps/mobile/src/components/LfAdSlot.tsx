import { useEffect, useState } from 'react';
import { View } from 'react-native';

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
  const [ad, setAd] = useState<LittlefingerNativeAd | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAd(null);
      return;
    }

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
  }, [enabled]);

  if (!enabled || ad === null) return null;

  return (
    <View testID="lf-ad-slot">
      <NativeAdCard ad={ad} />
    </View>
  );
}
