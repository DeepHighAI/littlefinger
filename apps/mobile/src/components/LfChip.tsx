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

// CSS 원본 `.lf-chip` 이 토큰 대신 고정 13px 를 쓴다 — 그대로 미러링 (ADR 0012).
const CHIP_FONT_SIZE = 13;
// 잉크 테두리: 상태 칩 2px, 필터 탭(.lf-tab 대응) 2.2px.
const CHIP_BORDER_WIDTH = 2;
const TAB_BORDER_WIDTH = 2.2;

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: space[1],
    paddingHorizontal: space[5],
    borderRadius: radius.pill,
    borderWidth: CHIP_BORDER_WIDTH,
    borderColor: colors.text,
    backgroundColor: colors.surface,
  },
  baseMd: {
    paddingVertical: space[2],
  },
  text: {
    fontSize: CHIP_FONT_SIZE,
    fontWeight: weight.bold,
    fontFamily: brandFontFamily(weight.bold),
  },
  textMd: {
    fontSize: type.body,
  },
  // 톤은 스티커 배경으로만 구분, 테두리는 잉크 공통 (broken 만 빨강)
  status: { backgroundColor: colors.primaryContainer },
  info: { backgroundColor: colors.recordContainer },
  neutral: { backgroundColor: colors.primaryContainer },
  urgent: { backgroundColor: colors.attentionContainer },
  done: { backgroundColor: colors.primaryContainer },
  broken: { backgroundColor: colors.errorContainer, borderColor: colors.error },
  // 필터 칩 (.lf-tab 대응) — 선택은 잉크 필, 비선택은 표면 + 잉크 테두리
  ink: { backgroundColor: colors.text, borderWidth: TAB_BORDER_WIDTH, borderColor: colors.text },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: TAB_BORDER_WIDTH,
    borderColor: colors.text,
  },
  statusText: { color: colors.text },
  infoText: { color: colors.record },
  neutralText: { color: colors.text },
  urgentText: { color: colors.attention },
  doneText: { color: colors.text },
  brokenText: { color: colors.error },
  inkText: { color: colors.background },
  outlineText: { color: colors.text },
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
