import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, line, radius, size, space, type, weight } from '../theme/tokens';

const styles = StyleSheet.create({
  input: {
    minHeight: size.textareaMinHeight,
    borderWidth: border.chip,
    borderColor: colors.text,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space[6],
    paddingVertical: space[5],
    fontFamily: textFontFamily(weight.regular),
    fontSize: type.body,
    lineHeight: line.body,
    textAlignVertical: 'top',
  },
});

export function LfTextarea(props: TextInputProps): React.JSX.Element {
  return (
    <TextInput
      multiline
      placeholderTextColor={colors.textFaint}
      {...props}
      style={styles.input}
    />
  );
}
