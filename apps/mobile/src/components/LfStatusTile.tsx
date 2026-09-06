import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, border, radius, size } from '../theme/tokens';
import { LfIcon, type LfIconName } from './LfIcon';

export type LfStatusTileTone = 'paper' | 'yellow' | 'mint' | 'pink' | 'sky' | 'muted';

export interface LfStatusTileProps extends Omit<ViewProps, 'style' | 'children'> {
  icon: LfIconName;
  tone: LfStatusTileTone;
  dashed?: boolean;
}

const toneColor: Record<LfStatusTileTone, string> = {
  paper: colors.surface,
  yellow: colors.primaryContainer,
  mint: colors.successContainer,
  pink: colors.attentionContainer,
  sky: colors.recordContainer,
  muted: colors.surfaceMuted,
};

/** 리스트 행 상태 타일 40 r10 — 색만으로 상태를 말하지 않으므로 항상 라벨 텍스트와 함께 놓는다. */
export function LfStatusTile({ icon, tone, dashed = false, ...rest }: LfStatusTileProps): React.JSX.Element {
  return (
    <View
      {...rest}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { backgroundColor: toneColor[tone] }, dashed && styles.dashed]}
    >
      <LfIcon name={icon} size={size.appbarIcon} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: size.statusTile,
    height: size.statusTile,
    borderRadius: radius.sm,
    borderWidth: border.chip,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashed: { borderStyle: 'dashed' },
});
