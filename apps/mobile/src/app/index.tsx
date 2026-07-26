import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfButton } from '../components/LfButton';
import { LfNotice } from '../components/LfNotice';
import { LfPinky } from '../components/LfPinky';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import { brandFontFamily } from '../theme/fonts';
import { colors, line, space, type, weight } from '../theme/tokens';

/**
 * SCR-A01 로그인 — `design-reference/screens/app/scr-a01-login.html` 이식.
 *
 * 미리보기 전용 스캐폴딩은 걷어냈다: `lf-device` 래퍼와 `frame.js` 가 그리던
 * 상태 표시줄·제스처 바는 `SafeAreaView` 가 대신한다(04 §5-3).
 *
 * **광고 없음** — 신뢰 순간 화면이다(04 §12-1).
 *
 * 아래 숫자들은 원본 `screens/app-entry.css` 의 화면 전용 값이다. tokens.css 에 없는 값이고
 * `design-reference/` 는 읽기 전용이라 토큰으로 승격할 수 없어, 여기 이름을 붙여 둔다.
 */

const LOGIN_GUTTER = 28;
const BADGE_SIZE = 136;
const BADGE_RADIUS = 46;
const WORDMARK_SIZE = 30;
const WORDMARK_LINE = 38;
const WORDMARK_TRACKING = -0.5;
const SUBTITLE_SIZE = 15;
const ACTIONS_BOTTOM = 28;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LOGIN_GUTTER,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_RADIUS,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginTop: 22,
    fontSize: WORDMARK_SIZE,
    lineHeight: WORDMARK_LINE,
    fontWeight: weight.heavy,
    letterSpacing: WORDMARK_TRACKING,
    color: colors.text,
    fontFamily: brandFontFamily(weight.heavy),
  },
  subtitle: {
    marginTop: space[3],
    fontSize: SUBTITLE_SIZE,
    color: colors.textSecondary,
    fontFamily: brandFontFamily(weight.regular),
  },
  hook: { marginTop: space[7] },
  actions: {
    paddingHorizontal: space[9],
    paddingBottom: ACTIONS_BOTTOM,
  },
  terms: {
    fontSize: type.caption,
    lineHeight: line.micro,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: brandFontFamily(weight.regular),
  },
  termsLink: { textDecorationLine: 'underline' },
});

export default function LoginScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        {/* 로고를 누르면 새끼손가락을 거는 반응이 재생될 자리 (원본 .lf-pinky--tapped) */}
        <Pressable
          style={styles.badge}
          accessibilityRole="button"
          accessibilityLabel="리틀핑거 로고"
        >
          <LfPinky size="xl" tone="onContainer" />
        </Pressable>

        <Text style={styles.wordmark}>리틀핑거</Text>
        <Text style={styles.subtitle}>새끼손가락 걸고, 약속!</Text>
        {/* 여백은 화면의 몫이다. 컴포넌트는 style 을 받지 않아 디자인 값이 새지 않는다. */}
        <View style={styles.hook}>
          <LfNotice label="오늘도 새끼손가락 걸어볼까요?" />
        </View>
      </View>

      <View style={styles.actions}>
        <LfStack gap={6}>
          <LfButton variant="kakao" size="cta" block label="카카오로 시작하기" />
          <Text style={styles.terms}>
            시작하면 <Text style={styles.termsLink}>이용약관</Text>과{' '}
            <Text style={styles.termsLink}>개인정보 처리방침</Text>에 동의하게 돼요
          </Text>
        </LfStack>
      </View>
    </SafeAreaView>
  );
}
