import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, border, radius, size } from '../theme/tokens';
import type { LfChipTone } from './LfChip';

export interface LfStatusDotProps extends Omit<ViewProps, 'style'> {
  tone: LfChipTone;
}

const toneColor: Record<LfChipTone, string> = {
  paper: colors.surface,
  yellow: colors.primaryContainer,
  mint: colors.successContainer,
  pink: colors.attentionContainer,
  sky: colors.recordContainer,
  muted: colors.surfaceMuted,
  cream: colors.background,
};

export function LfStatusDot({ tone, ...rest }: LfStatusDotProps): React.JSX.Element {
  return (
    <View
      {...rest}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.dot, { backgroundColor: toneColor[tone] }]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: size.statusDot,
    height: size.statusDot,
    borderRadius: radius.pill,
    borderWidth: border.chip,
    borderColor: colors.text,
  },
});
