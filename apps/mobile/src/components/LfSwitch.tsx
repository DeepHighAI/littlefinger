import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, size, space } from '../theme/tokens';

export interface LfSwitchProps {
  accessibilityLabel: string;
  value: boolean;
  onValueChange(value: boolean): void;
}

const styles = StyleSheet.create({
  track: {
    width: size.touchMin,
    minHeight: size.touchMin,
    padding: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  checked: { backgroundColor: colors.primary },
  thumb: {
    width: space[8],
    height: space[8],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  checkedThumb: { alignSelf: 'flex-end' },
});

export function LfSwitch({
  accessibilityLabel,
  value,
  onValueChange,
}: LfSwitchProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={[styles.track, value && styles.checked]}
    >
      <View style={[styles.thumb, value && styles.checkedThumb]} />
    </Pressable>
  );
}
