import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, elevation, radius, space, type, weight } from '../theme/tokens';

export type LfNoticeTone = 'paper' | 'pink';

export interface LfNoticeProps extends Omit<ViewProps, 'style' | 'children'> {
  label: string;
  /** 응답 필요·마감 안내는 핑크 + 3px */
  tone?: LfNoticeTone;
}

/** README 안내 32h — 토큰 없음, ADR 0020 예외 */
const NOTICE_HEIGHT = 32;

/** 한 줄 안내 블록 — 종이 r8 2px 잉크, 그림자 없음 (`.lf-notice`) */
const styles = StyleSheet.create({
  notice: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: NOTICE_HEIGHT,
    paddingHorizontal: space[5],
    borderRadius: radius.xs,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
  },
  pink: { backgroundColor: colors.attentionContainer, ...elevation.sm },
  label: {
    fontSize: type.caption,
    color: colors.text,
    fontFamily: textFontFamily(weight.bold),
  },
});

export function LfNotice({ label, tone = 'paper', ...rest }: LfNoticeProps): React.JSX.Element {
  return (
    <View {...rest} style={[styles.notice, tone === 'pink' && styles.pink]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
