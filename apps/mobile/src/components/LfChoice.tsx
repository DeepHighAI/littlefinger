import { Pressable, StyleSheet, Text } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, radius, size, space, type, weight } from '../theme/tokens';

export interface LfChoiceProps {
  label: string;
  selected: boolean;
  onPress(): void;
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.touchMin,
    paddingHorizontal: space[6],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: brandFontFamily(weight.medium),
    fontWeight: weight.medium,
    fontSize: type.label,
  },
  selectedLabel: { color: colors.onPrimaryContainer, fontWeight: weight.bold },
});

export function LfChoice({ label, selected, onPress }: LfChoiceProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.base, selected && styles.selected]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}
