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

/** 글자 배율과 가용 폭에 따라 높이를 늘려 안내 문구를 모두 보여준다. */
const styles = StyleSheet.create({
  notice: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: NOTICE_HEIGHT,
    maxWidth: '100%',
    paddingVertical: space[2],
    paddingHorizontal: space[5],
    borderRadius: radius.xs,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
  },
  pink: { backgroundColor: colors.attentionContainer, ...elevation.sm },
  label: {
    flexShrink: 1,
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
