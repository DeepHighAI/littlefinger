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

const styles = StyleSheet.create({
  picker: {
    minHeight: size.touchMin,
    paddingHorizontal: space[6],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineStrong,
    borderRadius: radius.sm,
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
