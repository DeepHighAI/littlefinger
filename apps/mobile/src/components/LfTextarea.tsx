import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, radius, size, space, type, weight } from '../theme/tokens';

const styles = StyleSheet.create({
  input: {
    minHeight: size.touchMin * 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space[6],
    paddingVertical: space[5],
    fontFamily: brandFontFamily(weight.regular),
    fontSize: type.body,
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
