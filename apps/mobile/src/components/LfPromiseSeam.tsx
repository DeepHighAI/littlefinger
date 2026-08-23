import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, duration, easing, size, space } from '../theme/tokens';
import { LfPinky } from './LfPinky';

const styles = StyleSheet.create({
  root: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  side: { flex: 1, overflow: 'hidden' },
  line: { width: '100%', height: StyleSheet.hairlineWidth, backgroundColor: colors.primaryInk },
});

export function promiseSeamDuration(reduceMotion: boolean): number {
  return reduceMotion ? 0 : duration.long;
}

export function LfPromiseSeam(): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const motionDuration = promiseSeamDuration(reduceMotion);
    progress.value = motionDuration === 0
      ? 1
      : withTiming(1, {
          duration: motionDuration,
          easing: Easing.bezier(...easing.emphasizedDecelerate),
        });
  }, [progress, reduceMotion]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-space[7], 0]) }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [space[7], 0]) }],
  }));

  return (
    <View
      testID="promise-seam"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.root}
    >
      <View style={styles.side}><Animated.View style={[styles.line, leftStyle]} /></View>
      <LfPinky size="xs" />
      <View style={styles.side}><Animated.View style={[styles.line, rightStyle]} /></View>
    </View>
  );
}
