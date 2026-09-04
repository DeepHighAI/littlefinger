import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, border, elevation, radius, size, tilt as tiltToken } from '../theme/tokens';

export type LfCardTone = 'paper' | 'yellow' | 'mint' | 'pink' | 'sky' | 'muted';
export type LfCardTilt = 'sticker' | 'hero' | 'none';
export type LfCardShape = 'card' | 'list';

export interface LfCardProps extends Omit<ViewProps, 'style'> {
  tone?: LfCardTone;
  flat?: boolean;
  tilt?: LfCardTilt;
  shape?: LfCardShape;
}

const toneColor: Record<LfCardTone, string> = {
  paper: colors.surface,
  yellow: colors.primaryContainer,
  mint: colors.successContainer,
  pink: colors.attentionContainer,
  sky: colors.recordContainer,
  muted: colors.surfaceMuted,
};

const styles = StyleSheet.create({
  base: {
    borderWidth: border.card,
    borderColor: colors.text,
    padding: size.cardPadding,
    ...elevation.card,
  },
  flat: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export function LfCard({
  tone = 'paper',
  flat = false,
  tilt = 'none',
  shape = 'card',
  ...rest
}: LfCardProps): React.JSX.Element {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: toneColor[tone],
          borderRadius: shape === 'card' ? radius.xl : radius.lg,
        },
        tilt !== 'none' && { transform: [{ rotate: tiltToken[tilt] }] },
        flat && styles.flat,
      ]}
    />
  );
}
