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
import { colors, border, duration, easing, size } from '../theme/tokens';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export interface LfTrustRingProps {
  rate: number | null;
  testID?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CENTER = size.trustRing / 2;
const PROGRESS_RADIUS = CENTER - size.trustRingStroke / 2 - border.pending;
const OUTER_INK_RADIUS = CENTER - border.pending;
const INNER_INK_RADIUS = PROGRESS_RADIUS - size.trustRingStroke / 2;
const CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

export function trustRingDuration(reduceMotion: boolean): number {
  return reduceMotion ? 0 : duration.long;
}

export function LfTrustRing({ rate, testID }: LfTrustRingProps): React.JSX.Element {
  const LABEL = useLabels(MOBILE_CHROME_LABEL);
  const reduceMotion = useReducedMotion();
  const clampedRate = rate === null ? null : Math.min(100, Math.max(0, rate));
  const normalized = clampedRate === null ? 0 : clampedRate / 100;
  const progress = useSharedValue(reduceMotion ? normalized : 0);

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
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
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
      style={styles.root}
    >
      <Svg width={size.trustRing} height={size.trustRing} style={StyleSheet.absoluteFill}>
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={PROGRESS_RADIUS}
          fill="none"
          stroke={colors.surfaceMuted}
          strokeWidth={size.trustRingStroke}
        />
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={PROGRESS_RADIUS}
          fill="none"
          stroke={colors.successContainer}
          strokeWidth={size.trustRingStroke}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
        <Circle cx={CENTER} cy={CENTER} r={OUTER_INK_RADIUS} fill="none" stroke={colors.text} strokeWidth={border.chip} />
        <Circle cx={CENTER} cy={CENTER} r={INNER_INK_RADIUS} fill="none" stroke={colors.text} strokeWidth={border.chip} />
      </Svg>
      <LfStack grow center>
        <LfText variant={clampedRate === null ? 'meta' : 'heading'}>
          {clampedRate === null ? LABEL.trustPending : `${clampedRate}%`}
        </LfText>
      </LfStack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: size.trustRing, height: size.trustRing },
});
