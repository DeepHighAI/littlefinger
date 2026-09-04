import { Pressable, StyleSheet, Text, View } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, radius, size, space, type, weight } from '../theme/tokens';

export interface LfChoiceProps {
  label: string;
  selected: boolean;
  onPress(): void;
}

const styles = StyleSheet.create({
  target: {
    minHeight: size.touchMin,
    justifyContent: 'center',
  },
  visual: {
    height: size.chipSelectHeight,
    paddingHorizontal: space[6],
    borderRadius: radius.pill,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.primaryContainer,
  },
  label: {
    color: colors.text,
    fontFamily: textFontFamily(weight.medium),
    fontWeight: weight.medium,
    fontSize: type.label,
  },
  selectedLabel: { color: colors.text, fontWeight: weight.bold },
});

export function LfChoice({ label, selected, onPress }: LfChoiceProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.target}
    >
      <View style={[styles.visual, selected && styles.selected]}>
        <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
      </View>
    </Pressable>
  );
}
