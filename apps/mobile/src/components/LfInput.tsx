import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, line, radius, size, space, type, weight } from '../theme/tokens';

const styles = StyleSheet.create({
  input: {
    height: size.inputHeight,
    minHeight: size.touchMin,
    borderWidth: border.chip,
    borderColor: colors.text,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    fontFamily: textFontFamily(weight.regular),
    fontSize: type.body,
    lineHeight: line.body,
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
