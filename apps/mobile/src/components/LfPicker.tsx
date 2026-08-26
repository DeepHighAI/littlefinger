import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, size, space } from '../theme/tokens';
import { LfIcon } from './LfIcon';
import { LfText } from './LfText';

export interface LfPickerProps {
  accessibilityLabel: string;
  value?: string | undefined;
  placeholder: string;
  onPress(): void;
  disabled?: boolean;
}

// 잉크 테두리 피커 (ADR 0012)
const PICKER_BORDER_WIDTH = 2;

const styles = StyleSheet.create({
  picker: {
    minHeight: size.touchMin,
    paddingHorizontal: space[6],
    borderWidth: PICKER_BORDER_WIDTH,
    borderColor: colors.text,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
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
      style={styles.picker}
    >
      <LfIcon name="event" color="primary" />
      <View style={styles.value}>
        <LfText secondary={value === undefined}>{value ?? placeholder}</LfText>
      </View>
      <LfIcon name="expand-more" color="textMuted" />
    </Pressable>
  );
}
