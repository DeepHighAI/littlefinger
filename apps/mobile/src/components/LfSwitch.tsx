import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, size, space } from '../theme/tokens';

export interface LfSwitchProps {
  accessibilityLabel: string;
  value: boolean;
  onValueChange(value: boolean): void;
  disabled?: boolean;
}

// 잉크 테두리 트랙 — ON 은 버터 트랙 + 잉크 노브 (ADR 0012)
const TRACK_BORDER_WIDTH = 2.2;

const styles = StyleSheet.create({
  track: {
    width: size.touchMin,
    minHeight: size.touchMin,
    padding: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: TRACK_BORDER_WIDTH,
    borderColor: colors.text,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  checked: { backgroundColor: colors.primaryContainer },
  thumb: {
    width: space[8],
    height: space[8],
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
      style={[styles.track, value && styles.checked]}
    >
      <View style={[styles.thumb, value && styles.checkedThumb]} />
    </Pressable>
  );
}
