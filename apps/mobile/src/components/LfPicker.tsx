import { Pressable, StyleSheet, View } from 'react-native';

import { colors, border, elevation, radius, size, space } from '../theme/tokens';
import { LfIcon } from './LfIcon';
import { LfText } from './LfText';

export interface LfPickerProps {
  accessibilityLabel: string;
  value?: string | undefined;
  placeholder: string;
  onPress(): void;
  disabled?: boolean;
}

/** README 눌림 — translate 3, 3px 그림자는 사라진다. 토큰 없음, ADR 0020 예외 */
const PRESS_OFFSET = 3;
/** README 피커 아이콘 18 — 토큰 없음, ADR 0020 예외 */
const LEADING_ICON = 18;

const styles = StyleSheet.create({
  // 입력과 같은 48 r10 2px 종이지만 피커만 3px 그림자를 갖는다 (README §8)
  picker: {
    height: size.inputHeight,
    minHeight: size.touchMin,
    paddingHorizontal: space[6],
    borderWidth: border.chip,
    borderColor: colors.text,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    ...elevation.sm,
  },
  pressed: { transform: [{ translateX: PRESS_OFFSET }, { translateY: PRESS_OFFSET }], boxShadow: [] },
  value: { flex: 1 },
});

export function LfPicker({
  accessibilityLabel,
  value,
  placeholder,
  onPress,
  disabled = false,
}: LfPickerProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: value ?? placeholder }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.picker, pressed && styles.pressed]}
    >
      <LfIcon name="event" size={LEADING_ICON} />
      <View style={styles.value}>
        <LfText secondary={value === undefined}>{value ?? placeholder}</LfText>
      </View>
      <LfIcon name="expand_more" size={size.appbarIcon} />
    </Pressable>
  );
}
