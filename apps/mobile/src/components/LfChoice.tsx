import { Pressable, StyleSheet, Text } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, radius, size, space, type, weight } from '../theme/tokens';

export interface LfChoiceProps {
  label: string;
  selected: boolean;
  onPress(): void;
}

// 잉크 테두리 선택 칩 — 선택은 잉크 반전 (배경 잉크 · 글자 크림, ADR 0012)
const CHOICE_BORDER_WIDTH = 2.2;

const styles = StyleSheet.create({
  base: {
    minHeight: size.touchMin,
    paddingHorizontal: space[6],
    borderRadius: radius.pill,
    borderWidth: CHOICE_BORDER_WIDTH,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  label: {
    color: colors.text,
    fontFamily: textFontFamily(weight.medium),
    fontWeight: weight.medium,
    fontSize: type.label,
  },
  selectedLabel: { color: colors.background, fontWeight: weight.bold },
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
