import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme/tokens';

/**
 * 핑키 마크 — 원본 `.lf-pinky` (04 §5-2).
 *
 * 새끼손가락 두 개가 서로 걸린 형태다. path 좌표는 `design-reference` 의 SVG 원본 그대로다.
 * RN 은 SVG 를 기본 지원하지 않아 `react-native-svg` 가 필요하다
 * (04 §4-6 의존성 목록에 빠져 있던 항목).
 */

export type LfPinkySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/** 어떤 배경 위에 얹느냐에 따라 보조 획 색이 달라진다. */
export type LfPinkyTone = 'default' | 'onContainer' | 'onPrimary';

export interface LfPinkyProps {
  size?: LfPinkySize;
  tone?: LfPinkyTone;
  accessibilityLabel?: string;
  testID?: string;
}

/** 원본 `.lf-pinky--*` 의 --lf-pinky-size / --lf-pinky-stroke */
const SIZES: Record<LfPinkySize, { box: number; stroke: number }> = {
  xs: { box: 20, stroke: 16 },
  sm: { box: 26, stroke: 16 },
  md: { box: 46, stroke: 15 },
  lg: { box: 56, stroke: 15 },
  xl: { box: 64, stroke: 15 },
};

const LEFT_PATH = 'M40 14 L40 62 A21 21 0 0 0 82 62 L82 50';
const RIGHT_PATH = 'M80 106 L80 58 A21 21 0 0 0 38 58 L38 70';

function strokes(tone: LfPinkyTone): { left: string; right: string; rightOpacity: number } {
  switch (tone) {
    case 'onContainer':
      return { left: colors.primary, right: colors.surface, rightOpacity: 1 };
    case 'onPrimary':
      return { left: colors.onPrimary, right: colors.onPrimary, rightOpacity: 0.65 };
    default:
      return { left: colors.primary, right: colors.primaryPale, rightOpacity: 1 };
  }
}

export function LfPinky({
  size = 'md',
  tone = 'default',
  accessibilityLabel,
  testID,
}: LfPinkyProps): React.JSX.Element {
  const { box, stroke } = SIZES[size];
  const { left, right, rightOpacity } = strokes(tone);
  const decorative = accessibilityLabel === undefined;

  return (
    <Svg
      width={box}
      height={box}
      viewBox="0 0 120 120"
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      {...(testID === undefined ? {} : { testID })}
      {...(decorative ? {} : { accessible: true, accessibilityLabel })}
    >
      <Path d={LEFT_PATH} fill="none" stroke={left} strokeWidth={stroke} strokeLinecap="round" />
      <Path
        d={RIGHT_PATH}
        fill="none"
        stroke={right}
        strokeWidth={stroke}
        strokeLinecap="round"
        opacity={rightOpacity}
      />
    </Svg>
  );
}
