import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, radius, space, type, weight } from '../theme/tokens';

export type LfChipTone =
  | 'status'
  | 'info'
  | 'neutral'
  | 'urgent'
  | 'done'
  | 'broken'
  | 'ink'
  | 'outline';
export type LfChipSize = 'sm' | 'md';

export interface LfChipProps extends Omit<ViewProps, 'style' | 'children'> {
  label: string;
  tone?: LfChipTone;
  /** md 는 홈 필터 탭용 확대 칩 — FAB 라벨(type.body)과 크기를 맞춘다(PO 2026-08-23). */
  size?: LfChipSize;
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: space[1],
    paddingHorizontal: space[5],
    borderRadius: radius.pill,
  },
  baseMd: {
    paddingVertical: space[2],
  },
  text: {
    fontSize: type.micro,
    fontWeight: weight.bold,
    fontFamily: brandFontFamily(weight.bold),
  },
  textMd: {
    fontSize: type.body,
  },
  status: { backgroundColor: colors.primaryContainer },
  info: { backgroundColor: colors.recordContainer },
  neutral: { backgroundColor: colors.surfaceMuted },
  urgent: { backgroundColor: colors.attentionContainer },
  done: { backgroundColor: colors.successContainer },
  broken: { backgroundColor: colors.errorContainer },
  // 당근식 필터 칩 (ADR 0008) — 선택은 잉크 필, 비선택은 흰 바탕 + 헤어라인
  ink: { backgroundColor: colors.text, borderWidth: 1, borderColor: colors.text },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
  },
  statusText: { color: colors.onPrimaryContainer },
  infoText: { color: colors.record },
  neutralText: { color: colors.textSecondary },
  urgentText: { color: colors.attention },
  doneText: { color: colors.success },
  brokenText: { color: colors.error },
  inkText: { color: colors.background },
  outlineText: { color: colors.textSecondary },
});

export function LfChip({
  label,
  tone = 'neutral',
  size = 'sm',
  ...rest
}: LfChipProps): React.JSX.Element {
  return (
    <View {...rest} style={[styles.base, size === 'md' && styles.baseMd, styles[tone]]}>
      <Text style={[styles.text, size === 'md' && styles.textMd, styles[`${tone}Text`]]}>
        {label}
      </Text>
    </View>
  );
}
