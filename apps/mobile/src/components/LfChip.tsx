import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, radius, space, type, weight } from '../theme/tokens';

export type LfChipTone = 'status' | 'neutral' | 'urgent' | 'done' | 'broken';

export interface LfChipProps extends Omit<ViewProps, 'style' | 'children'> {
  label: string;
  tone?: LfChipTone;
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: space[1],
    paddingHorizontal: space[5],
    borderRadius: radius.pill,
  },
  text: {
    fontSize: type.micro,
    fontWeight: weight.bold,
    fontFamily: brandFontFamily(weight.bold),
  },
  status: { backgroundColor: colors.primaryContainer },
  neutral: { backgroundColor: colors.surfaceMuted },
  urgent: { backgroundColor: colors.primary },
  done: { backgroundColor: colors.successContainer },
  broken: { backgroundColor: colors.errorContainer },
  statusText: { color: colors.onPrimaryContainer },
  neutralText: { color: colors.textSecondary },
  urgentText: { color: colors.onPrimary },
  doneText: { color: colors.success },
  brokenText: { color: colors.error },
});

export function LfChip({
  label,
  tone = 'neutral',
  ...rest
}: LfChipProps): React.JSX.Element {
  return (
    <View {...rest} style={[styles.base, styles[tone]]}>
      <Text style={[styles.text, styles[`${tone}Text`]]}>{label}</Text>
    </View>
  );
}
