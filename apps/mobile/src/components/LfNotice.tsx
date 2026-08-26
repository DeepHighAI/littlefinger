import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, space, type, weight } from '../theme/tokens';

/** 원본 `.lf-notice` — 잉크&스티커에서는 잉크 밑줄 스타일 안내다 (ADR 0012). */

export interface LfNoticeProps extends Omit<ViewProps, 'style' | 'children'> {
  label: string;
}

// 원본 .lf-notice 의 화면 전용 수치. tokens.css 에 없는 값이라 여기 이름을 붙여 둔다.
const NOTICE_UNDERLINE_WIDTH = 2;
const NOTICE_PADDING_H = 2;
const NOTICE_PADDING_BOTTOM = 2;

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: NOTICE_PADDING_H,
    paddingBottom: NOTICE_PADDING_BOTTOM,
    borderBottomWidth: NOTICE_UNDERLINE_WIDTH,
    borderBottomColor: colors.text,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: type.caption,
    fontWeight: weight.bold,
    color: colors.textSecondary,
    fontFamily: brandFontFamily(weight.bold),
  },
});

export function LfNotice({ label, ...rest }: LfNoticeProps): React.JSX.Element {
  return (
    <View {...rest} style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
