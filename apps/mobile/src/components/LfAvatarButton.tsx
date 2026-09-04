import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, elevation, radius, size, type, weight } from '../theme/tokens';

export interface LfAvatarButtonProps extends Omit<PressableProps, 'children' | 'style' | 'hitSlop'> {
  nickname: string;
  accessibilityLabel: string;
}

const HIT_SLOP = (size.touchMin - size.iconButton) / 2;

export function LfAvatarButton({
  nickname,
  disabled,
  ...rest
}: LfAvatarButtonProps): React.JSX.Element {
  const isDisabled = disabled ?? false;
  const fallback = Array.from(nickname.trim())[0] ?? nickname;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={HIT_SLOP}
      {...rest}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, isDisabled && styles.disabled]}
    >
      <Text style={styles.label}>{fallback}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.fab,
  },
  label: {
    color: colors.primaryContainer,
    fontSize: type.label,
    fontWeight: weight.bold,
    fontFamily: textFontFamily(weight.bold),
  },
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.3 },
});
