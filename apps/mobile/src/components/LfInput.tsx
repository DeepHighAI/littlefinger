import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, radius, size, space, type, weight } from '../theme/tokens';

// 잉크 테두리 입력 필드 (ADR 0012)
const INPUT_BORDER_WIDTH = 2;

const styles = StyleSheet.create({
  input: {
    minHeight: size.touchMin,
    borderWidth: INPUT_BORDER_WIDTH,
    borderColor: colors.text,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    fontFamily: brandFontFamily(weight.regular),
    fontSize: type.body,
  },
});

export function LfInput(props: TextInputProps): React.JSX.Element {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={styles.input}
    />
  );
}
