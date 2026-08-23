import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useLabels } from '../lib/locale-native';
import { MOBILE_CHROME_LABEL } from '../screens/mobile-chrome-labels.ts';
import { colors, duration, easing, size as sizeToken, space } from '../theme/tokens';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export type LfTrustRingSize = 'sm' | 'lg';

export interface LfTrustRingProps {
  rate: number | null;
  size?: LfTrustRingSize;
  testID?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const STROKE_WIDTH = space[1];

export function trustRingDuration(reduceMotion: boolean): number {
  return reduceMotion ? 0 : duration.long;
}

function diameterOf(size: LfTrustRingSize): number {
  return size === 'sm'
    ? sizeToken.bottomNavContentHeight
    : sizeToken.bottomNavContentHeight + space[8] + space[5];
}

export function LfTrustRing({ rate, size = 'lg', testID }: LfTrustRingProps): React.JSX.Element {
  const LABEL = useLabels(MOBILE_CHROME_LABEL);
  const reduceMotion = useReducedMotion();
  const clampedRate = rate === null ? null : Math.min(100, Math.max(0, rate));
  const normalized = clampedRate === null ? 0 : clampedRate / 100;
  const progress = useSharedValue(reduceMotion ? normalized : 0);
  const diameter = diameterOf(size);
  const ringRadius = diameter / 2 - STROKE_WIDTH;
  const circumference = 2 * Math.PI * ringRadius;

  useEffect(() => {
    const motionDuration = trustRingDuration(reduceMotion);
    progress.value = motionDuration === 0
      ? normalized
      : withTiming(normalized, {
          duration: motionDuration,
          easing: Easing.bezier(...easing.emphasizedDecelerate),
        });
  }, [normalized, progress, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={LABEL.trustRate}
      accessibilityValue={clampedRate === null
        ? { text: LABEL.trustPending }
        : { min: 0, max: 100, now: clampedRate }}
      style={{ width: diameter, height: diameter }}
    >
      <Svg width={diameter} height={diameter} style={StyleSheet.absoluteFill}>
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={ringRadius}
          fill="none"
          stroke={colors.outline}
          strokeWidth={STROKE_WIDTH}
        />
        <AnimatedCircle
          cx={diameter / 2}
          cy={diameter / 2}
          r={ringRadius}
          fill="none"
          stroke={colors.primaryInk}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
        />
      </Svg>
      <LfStack grow center gap={1}>
        <LfText variant={clampedRate === null ? 'caption' : 'title'}>
          {clampedRate === null ? LABEL.trustPending : `${clampedRate}%`}
        </LfText>
      </LfStack>
    </View>
  );
}
