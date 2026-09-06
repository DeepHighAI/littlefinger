import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, elevation, radius, size, space, type, weight } from '../theme/tokens';

export type LfChipTone = 'paper' | 'yellow' | 'mint' | 'pink' | 'sky' | 'muted' | 'cream';
export type LfChipKind = 'status' | 'meta' | 'filter' | 'select';

export interface LfChipProps extends Omit<ViewProps, 'style' | 'children'> {
  label: string;
  tone?: LfChipTone;
  kind?: LfChipKind;
  selected?: boolean;
  dot?: boolean;
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

const kindHeight: Record<LfChipKind, number> = {
  status: size.chipStatusHeight,
  meta: size.chipMetaHeight,
  filter: size.tabHeight,
  select: size.chipSelectHeight,
};

const styles = StyleSheet.create({
  // 상태·메타 칩 28h r8 · 12/800
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.xs,
    borderWidth: border.chip,
    borderColor: colors.text,
  },
  // 필터 탭 34h · 선택 칩 36h — r10 · 13, 미선택 600 · 선택 800 + 3px (PO E8)
  large: { paddingHorizontal: space[6], borderRadius: radius.sm },
  selected: { ...elevation.sm },
  text: {
    color: colors.text,
    fontSize: type.meta,
    fontFamily: textFontFamily(weight.bold),
  },
  largeText: { fontSize: type.chip, fontFamily: textFontFamily(weight.medium) },
  selectedText: { fontFamily: textFontFamily(weight.bold) },
  dot: {
    width: size.statusDot - border.chip,
    height: size.statusDot - border.chip,
    borderRadius: radius.pill,
    backgroundColor: colors.successContainer,
  },
});

export function LfChip({
  label,
  tone = 'paper',
  kind = 'meta',
  selected = false,
  dot = false,
  ...rest
}: LfChipProps): React.JSX.Element {
  const large = kind === 'filter' || kind === 'select';
  return (
    <View
      {...rest}
      style={[
        styles.base,
        { height: kindHeight[kind], backgroundColor: selected ? colors.primaryContainer : toneColor[tone] },
        large && styles.large,
        large && selected && styles.selected,
      ]}
    >
      {dot ? <View testID={rest.testID === undefined ? undefined : `${rest.testID}-dot`} style={styles.dot} /> : null}
      <Text style={[styles.text, large && styles.largeText, large && selected && styles.selectedText]}>{label}</Text>
    </View>
  );
}
