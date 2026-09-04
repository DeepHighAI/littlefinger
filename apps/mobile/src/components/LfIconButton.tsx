import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, border, radius, size, type } from '../theme/tokens';
import { LfIcon, type LfIconName } from './LfIcon';

export interface LfIconButtonProps extends Omit<PressableProps, 'children' | 'style' | 'hitSlop'> {
  icon: LfIconName;
  accessibilityLabel: string;
  badge?: boolean;
}

const HIT_SLOP = (size.touchMin - size.iconButton) / 2;

export function LfIconButton({
  icon,
  badge = false,
  disabled,
  ...rest
}: LfIconButtonProps): React.JSX.Element {
  const isDisabled = disabled ?? false;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={HIT_SLOP}
      {...rest}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, isDisabled && styles.disabled]}
    >
      <LfIcon name={icon} size={size.appbarIcon} />
      {badge ? <View testID={rest.testID === undefined ? undefined : `${rest.testID}-badge`} style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.pill,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.primaryContainer },
  disabled: { opacity: 0.3 },
  badge: {
    position: 'absolute',
    top: type.micro - border.chip,
    right: type.micro - StyleSheet.hairlineWidth,
    width: size.statusDot - border.chip,
    height: size.statusDot - border.chip,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text,
    backgroundColor: colors.attentionContainer,
  },
});
