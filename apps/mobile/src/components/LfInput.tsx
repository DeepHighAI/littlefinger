import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, radius, size, space, type, weight } from '../theme/tokens';

const styles = StyleSheet.create({
  input: {
    minHeight: size.touchMin,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineStrong,
    borderRadius: radius.sm,
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
