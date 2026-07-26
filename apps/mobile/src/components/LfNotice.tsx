import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { brandFontFamily } from '../theme/fonts';
import { colors, radius, space, type, weight } from '../theme/tokens';

/** 원본 `.lf-notice` — 연한 로즈 배경의 알림 pill (04 §5-2) */

export interface LfNoticeProps extends Omit<ViewProps, 'style' | 'children'> {
  label: string;
}

// 원본 .lf-notice 의 화면 전용 수치. tokens.css 에 없는 값이라 여기 이름을 붙여 둔다.
const NOTICE_HEIGHT = 30;
const NOTICE_PADDING_H = 13;

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: NOTICE_HEIGHT,
    paddingHorizontal: NOTICE_PADDING_H,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  label: {
    fontSize: type.caption,
    fontWeight: weight.bold,
    color: colors.primary,
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
