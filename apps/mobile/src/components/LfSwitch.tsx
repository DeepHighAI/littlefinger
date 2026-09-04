import { Pressable, StyleSheet, View } from 'react-native';

import { colors, border, radius, size, space } from '../theme/tokens';

export interface LfSwitchProps {
  accessibilityLabel: string;
  value: boolean;
  onValueChange(value: boolean): void;
  disabled?: boolean;
}

const styles = StyleSheet.create({
  target: {
    width: size.switchWidth,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: size.switchWidth,
    height: size.switchHeight,
    paddingHorizontal: space[1],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: border.card,
    borderColor: colors.text,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  checked: { backgroundColor: colors.primaryContainer },
  thumb: {
    width: size.switchKnob,
    height: size.switchKnob,
    borderRadius: radius.pill,
    backgroundColor: colors.outlineIcon,
  },
  checkedThumb: { alignSelf: 'flex-end', backgroundColor: colors.text },
});

export function LfSwitch({
  accessibilityLabel,
  value,
  onValueChange,
  disabled = false,
}: LfSwitchProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={styles.target}
    >
      <View style={[styles.track, value && styles.checked]}>
        <View style={[styles.thumb, value && styles.checkedThumb]} />
      </View>
    </Pressable>
  );
}
