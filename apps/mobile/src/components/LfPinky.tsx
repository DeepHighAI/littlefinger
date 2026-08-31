import { Image } from 'react-native';

import { colors } from '../theme/tokens';

/** 승인된 버터·화이트·잉크 조합을 그대로 쓰는 핑키 마크. */

export type LfPinkySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface LfPinkyProps {
  size?: LfPinkySize;
  accessibilityLabel?: string;
  testID?: string;
}

const SIZES: Record<LfPinkySize, { width: number; height: number }> = {
  xs: { width: 28, height: 20 },
  sm: { width: 36, height: 26 },
  md: { width: 64, height: 46 },
  lg: { width: 78, height: 56 },
  xl: { width: 90, height: 64 },
};

const BRAND_SYMBOL = require('../../assets/images/brand-symbol-in-app.png') as number;

export function LfPinky({
  size = 'md',
  accessibilityLabel,
  testID,
}: LfPinkyProps): React.JSX.Element {
  const dimensions = SIZES[size];
  const decorative = accessibilityLabel === undefined;

  return (
    <Image
      source={BRAND_SYMBOL}
      resizeMode="contain"
      style={{ ...dimensions, backgroundColor: colors.primaryContainer }}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityRole="image"
      {...(testID === undefined ? {} : { testID })}
      {...(decorative ? {} : { accessible: true, accessibilityLabel })}
    />
  );
}
