import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, elevation, radius, size, space, type, weight } from '../theme/tokens';

export type LfDdayTone = 'yellow' | 'sky';

export interface LfDdayProps extends Omit<ViewProps, 'style' | 'children'> {
  label: string;
  /** 종료일 없음(∞)은 스카이 — 기록 톤 (`.lf-dday-circle--sky`) */
  tone?: LfDdayTone;
  accessibilityLabel: string;
}

/** 상세 헤더 D-Day 배지 — 56 r14 옐로 2px 잉크 + 3px, 15/900 (`.lf-dday-circle`) */
export function LfDday({ label, tone = 'yellow', accessibilityLabel, ...rest }: LfDdayProps): React.JSX.Element {
  return (
    <View
      {...rest}
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.tile, tone === 'sky' && styles.sky]}
    >
      <Text numberOfLines={1} style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minWidth: size.ddayCircle,
    minHeight: size.ddayCircle,
    paddingHorizontal: space[1],
    paddingVertical: space[2],
    flexShrink: 0,
    borderRadius: radius.md,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.chip,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.sm,
  },
  sky: { backgroundColor: colors.recordContainer },
  label: {
    fontSize: type.body,
    color: colors.text,
    fontFamily: textFontFamily(weight.heavy),
  },
});
