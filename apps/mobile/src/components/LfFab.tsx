import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, elevation, gutter, radius, size, space, type, weight } from '../theme/tokens';
import { LfPinky } from './LfPinky';

export interface LfFabProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: gutter.app,
    bottom: gutter.app,
    height: size.fabHeight,
    minHeight: size.touchMin,
    paddingHorizontal: space[9],
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    ...elevation.fab,
  },
  label: {
    color: colors.onPrimary,
    fontSize: type.body,
    fontWeight: weight.heavy,
    fontFamily: brandFontFamily(weight.heavy),
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
        pressed && { backgroundColor: colors.primaryPressed },
      ]}
    >
      <LfPinky size="xs" tone="onPrimary" />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
