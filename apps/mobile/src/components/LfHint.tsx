import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, line, radius, space, type, weight } from '../theme/tokens';
import { LfIcon, type LfIconName } from './LfIcon';

export type LfHintTone = 'muted' | 'sky';

export interface LfHintProps extends Omit<ViewProps, 'style' | 'children'> {
  icon: LfIconName;
  text: string;
  tone?: LfHintTone;
}

/** README 안내 아이콘 18 — 토큰 없음, ADR 0020 예외 */
const HINT_ICON = 18;

/** 시트 안 안내 상자 — 아이콘 + 12.5/18/800, 2px 잉크 r10, 뮤트 또는 스카이 (`.lf-hint`) */
export function LfHint({ icon, text, tone = 'muted', ...rest }: LfHintProps): React.JSX.Element {
  return (
    <View {...rest} style={[styles.box, tone === 'sky' && styles.sky]}>
      <LfIcon name={icon} size={HINT_ICON} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[4],
    paddingHorizontal: space[5],
    borderWidth: border.chip,
    borderColor: colors.text,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  sky: { backgroundColor: colors.recordContainer },
  text: {
    flex: 1,
    fontSize: type.caption,
    lineHeight: line.caption,
    fontFamily: textFontFamily(weight.bold),
    color: colors.text,
  },
});
