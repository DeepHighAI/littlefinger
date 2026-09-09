import { Pressable, StyleSheet, Text, View } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, radius, size, space, type, weight } from '../theme/tokens';

export interface LfChoiceProps {
  label: string;
  selected: boolean;
  onPress(): void;
}

const styles = StyleSheet.create({
  // 보이는 칩은 36h 지만 누르는 상자는 48 — 갤러리의 ::after 와 같은 역할
  target: {
    minHeight: size.touchMin,
    maxWidth: '100%',
    justifyContent: 'center',
  },
  visual: {
    minHeight: size.chipSelectHeight,
    paddingHorizontal: space[6],
    paddingVertical: space[2],
    borderRadius: radius.sm,
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
    flexShrink: 1,
    color: colors.text,
    fontFamily: textFontFamily(weight.medium),
    fontSize: type.chip,
  },
  selectedLabel: { fontFamily: textFontFamily(weight.bold) },
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
