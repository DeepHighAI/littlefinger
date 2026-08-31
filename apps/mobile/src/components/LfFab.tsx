import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, elevation, gutter, radius, size, space, type, weight } from '../theme/tokens';
import { LfPinky } from './LfPinky';

export interface LfFabProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
}

const styles = StyleSheet.create({
  button: {
    // 잉크&스티커 시안 1a: 우하단 → 하단 중앙 (CSS 원본과 같은 자기 기준 -50% 이동)
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: '-50%' }],
    bottom: gutter.app,
    height: size.fabHeight,
    minHeight: size.touchMin,
    paddingHorizontal: space[9],
    borderRadius: radius.pill,
    backgroundColor: colors.actionFill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    ...elevation.fab,
  },
  label: {
    color: colors.onAction,
    fontSize: type.body,
    fontWeight: weight.bold,
    fontFamily: textFontFamily(weight.bold),
  },
});

export function LfFab({ label, ...rest }: LfFabProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        pressed && { backgroundColor: colors.actionFillPressed },
      ]}
    >
      <LfPinky size="xs" />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
