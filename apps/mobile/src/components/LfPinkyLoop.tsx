import { useCallback, useEffect } from 'react';
import { AppState, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, duration, easing, radius, size as sizeToken } from '../theme/tokens';

export type LfPinkyLoopSize = 'sm' | 'md' | 'lg' | 'eyes';
export type LfPinkyLoopVariant = 'color' | 'solid';

export interface LfPinkyLoopProps extends Omit<ViewProps, 'children' | 'style'> {
  size?: LfPinkyLoopSize;
  variant?: LfPinkyLoopVariant;
  spark?: boolean;
  accessibilityLabel?: string;
}

const HAND_COLOR = require('../../assets/images/hand-color.png') as number;
const HAND_SOLID = require('../../assets/images/hand-solid.png') as number;
const HAND_ASPECT_RATIO = 804 / 763;
const COLOR_GAP_RATIO = 0.12;
const EYES_GAP_RATIO = 0.5;
const SPARK_EDGE_RATIO = 0.22;
const SPARK_TOP_RATIO = 0.18;

const LOOP_SIZE: Record<LfPinkyLoopSize, number> = {
  sm: sizeToken.pinkySm,
  md: sizeToken.pinkyMd,
  lg: sizeToken.pinkyLg,
  eyes: sizeToken.pinkyEyes,
};

export function pinkyLoopDuration(reduceMotion: boolean): number {
  return reduceMotion ? 0 : duration.pinky;
}

export function LfPinkyLoop({
  size = 'md',
  variant = 'color',
  spark = false,
  accessibilityLabel,
  testID,
  ...rest
}: LfPinkyLoopProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const loopSize = LOOP_SIZE[size];
  const handWidth = loopSize * HAND_ASPECT_RATIO;
  const gap = loopSize * (size === 'eyes' ? EYES_GAP_RATIO : COLOR_GAP_RATIO);
  const source = variant === 'color' ? HAND_COLOR : HAND_SOLID;

  const start = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (pinkyLoopDuration(reduceMotion) === 0) return;
    progress.value = withRepeat(
      withTiming(1, {
        duration: duration.pinky,
        easing: Easing.bezier(...easing.pinky),
      }),
      -1,
      false,
    );
  }, [progress, reduceMotion]);

  useEffect(() => {
    start();
    const blurSubscription = AppState.addEventListener('blur', () => cancelAnimation(progress));
    const focusSubscription = AppState.addEventListener('focus', start);
    return () => {
      blurSubscription.remove();
      focusSubscription.remove();
      cancelAnimation(progress);
    };
  }, [progress, start]);

  const handStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 0.15, 0.45, 0.6, 0.75, 1], [4, 4, -3, -3, -2, 4]) },
      { translateY: interpolate(progress.value, [0, 0.15, 0.45, 0.6, 0.75, 1], [0, 0, -2, -2, -1, 0]) },
      { rotate: `${interpolate(progress.value, [0, 0.15, 0.45, 0.6, 0.75, 1], [8, 8, -6, -6, -3, 8])}deg` },
    ],
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 0.52, 0.7, 1], [0, 0, 1, 0, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 0.4, 0.52, 0.7, 1], [0.4, 0.4, 1.1, 1.3, 1.3]) }],
  }));
  const decorative = accessibilityLabel === undefined;
  const sparkEdge = loopSize * SPARK_EDGE_RATIO;

  return (
    <View
      {...rest}
      testID={testID}
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={{ width: handWidth * 2 + gap, height: loopSize }}
    >
      <View
        testID={testID === undefined ? undefined : `${testID}-left`}
        style={[styles.hand, { width: handWidth, height: loopSize, transform: [{ scaleX: -1 }] }]}
      >
        <Animated.Image
          testID={testID === undefined ? undefined : `${testID}-hand`}
          source={source}
          resizeMode="contain"
          style={[
            { width: handWidth, height: loopSize, transformOrigin: '50% 90%' },
            reduceMotion ? styles.reducedHand : handStyle,
          ]}
        />
      </View>
      <View style={[styles.hand, styles.right, { width: handWidth, height: loopSize }]}>
        <Animated.Image
          testID={testID === undefined ? undefined : `${testID}-hand`}
          source={source}
          resizeMode="contain"
          style={[
            { width: handWidth, height: loopSize, transformOrigin: '50% 90%' },
            reduceMotion ? styles.reducedHand : handStyle,
          ]}
        />
      </View>
      {spark && !reduceMotion ? (
        <Animated.View
          testID={testID === undefined ? undefined : `${testID}-spark`}
          style={[
            styles.spark,
            {
              top: loopSize * SPARK_TOP_RATIO,
              left: (handWidth * 2 + gap - sparkEdge) / 2,
              width: sparkEdge,
              height: sparkEdge,
            },
            sparkStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hand: { position: 'absolute', top: 0, left: 0 },
  right: { left: undefined, right: 0 },
  spark: {
    position: 'absolute',
    borderRadius: radius.pill,
    backgroundColor: colors.primaryContainer,
  },
  reducedHand: {
    transform: [{ translateX: 4 }, { translateY: 0 }, { rotate: '8deg' }],
  },
});
