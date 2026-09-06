import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, border, elevation, radius, size } from '../theme/tokens';
import { LfInkContext } from './LfText';

export type LfCardTone = 'paper' | 'yellow' | 'mint' | 'pink' | 'sky' | 'muted';
export type LfCardShape = 'card' | 'list';

export interface LfCardProps extends Omit<ViewProps, 'style'> {
  tone?: LfCardTone;
  flat?: boolean;
  shape?: LfCardShape;
  /** false 면 테두리만 남기고 5px 그림자를 뺀다 (`.lf-card--flat`) */
  shadow?: boolean;
}

const toneColor: Record<LfCardTone, string> = {
  paper: colors.surface,
  yellow: colors.primaryContainer,
  mint: colors.successContainer,
  pink: colors.attentionContainer,
  sky: colors.recordContainer,
  muted: colors.surfaceMuted,
};

/** 4색 면 — 안의 보조·메타 글자를 잉크로 바꾼다 */
const FACE_TONES: ReadonlySet<LfCardTone> = new Set(['yellow', 'mint', 'pink', 'sky']);

const styles = StyleSheet.create({
  base: {
    borderWidth: border.card,
    borderColor: colors.text,
    padding: size.cardPadding,
    ...elevation.card,
  },
  noShadow: { boxShadow: [] },
  flat: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    boxShadow: [],
  },
});

export function LfCard({
  tone = 'paper',
  flat = false,
  shape = 'card',
  shadow = true,
  children,
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
        !shadow && styles.noShadow,
        flat && styles.flat,
      ]}
    >
      <LfInkContext.Provider value={FACE_TONES.has(tone)}>{children}</LfInkContext.Provider>
    </View>
  );
}
