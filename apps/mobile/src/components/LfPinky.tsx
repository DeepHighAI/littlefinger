import { Image } from 'react-native';

import { colors } from '../theme/tokens';

/**
 * 새 브랜드 핑키 마크 — 서로 새끼손가락을 건 두 손의 단색 실루엣.
 * 승인된 원본 하나를 tint해서 배경별 대비만 바꾸므로 화면마다 형태가 달라지지 않는다.
 */

export type LfPinkySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/** 소프트 액션 면만 밝은 아이보리로 반전하고 나머지는 승인된 진한 그린을 유지한다. */
export type LfPinkyTone = 'default' | 'record' | 'onContainer' | 'onPrimary';

export interface LfPinkyProps {
  size?: LfPinkySize;
  tone?: LfPinkyTone;
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

const BRAND_SYMBOL = require('../../assets/images/brand-symbol.png') as number;

function tint(tone: LfPinkyTone): string {
  if (tone === 'onPrimary') return colors.brandSymbolOnAction;
  if (tone === 'record') return colors.record;
  return colors.brandSymbol;
}

export function LfPinky({
  size = 'md',
  tone = 'default',
  accessibilityLabel,
  testID,
}: LfPinkyProps): React.JSX.Element {
  const dimensions = SIZES[size];
  const decorative = accessibilityLabel === undefined;

  return (
    <Image
      source={BRAND_SYMBOL}
      resizeMode="contain"
      style={{ ...dimensions, tintColor: tint(tone) }}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityRole="image"
      {...(testID === undefined ? {} : { testID })}
      {...(decorative ? {} : { accessible: true, accessibilityLabel })}
    />
  );
}
