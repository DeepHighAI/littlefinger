import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEGAL_DOCUMENT_LABELS_BY_LOCALE, type LegalDocumentKind } from '@littlefinger/shared';

import { GoogleMark } from '../components/GoogleMark';
import { LfBlob } from '../components/LfBlob';
import { LfButton } from '../components/LfButton';
import { LfIcon } from '../components/LfIcon';
import { LfInput } from '../components/LfInput';
import { LfNotice } from '../components/LfNotice';
import { LfPinkyLoop } from '../components/LfPinkyLoop';
import { LfStack } from '../components/LfStack';
import {
  signInWithGoogle,
  signInWithKakao,
} from '../lib/kakao-auth-native.ts';
import { openLegalDocument } from '../lib/legal-native.ts';
import { useLabels } from '../lib/locale-native';
import { useMobileAuthGate } from '../lib/mobile-auth-gate.ts';
import { LOGIN_LABEL } from '../screens/login-labels.ts';
import { textFontFamily } from '../theme/fonts';
import { border, colors, line, radius, size, space, type, weight } from '../theme/tokens';

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

// 테스트 로그인 모듈은 __DEV__ 가드 안의 require 로만 붙인다 — 정적 import 는 JSX 게이트와
// 달리 프로덕션 번들에 남지만, 이 형태는 Metro 상수 접기 + DCE 가 모듈째 걷어낸다.
const testAuth = __DEV__
  ? (require('../lib/test-auth-native.ts') as typeof import('../lib/test-auth-native.ts'))
  : null;

const LOGIN_GUTTER = 28;
// 잉크&스티커 워드마크 — Pretendard 40/46, 자간 3 (.lf-login__wordmark)
const WORDMARK_SIZE = 40;
const WORDMARK_LINE = 46;
const WORDMARK_TRACKING = 3;
const SUBTITLE_SIZE = 15;
const ACTIONS_BOTTOM = 28;
const CONSENT_BOX = 22;
const CONSENT_MARK = 16;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LOGIN_GUTTER,
    paddingVertical: space[9],
  },
  // 배지 상자는 걷어내고 마스코트가 그대로 앉는다 (.lf-login__badge 리셋)
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginTop: 22,
    // letterSpacing 은 마지막 글자 뒤에도 붙는다. 내용 크기 상자에서는 그 여백까지
    // 재지 못해 끝 글자가 깎일 수 있어, 여기도 본문 폭으로 펴고 가운데 정렬한다.
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: WORDMARK_SIZE,
    lineHeight: WORDMARK_LINE,
    fontWeight: weight.bold,
    letterSpacing: WORDMARK_TRACKING,
    color: colors.text,
    fontFamily: textFontFamily(weight.bold),
  },
  subtitle: {
    marginTop: space[3],
    // body 가 alignItems:'center' 라 이 Text 는 내용 폭으로만 상자가 잡힌다. 그러면 폭이
    // 조금만 모자라도 '새끼손가락 걸고,' 에서 끊긴다. 상자를 본문 폭으로 펴고 정렬은
    // textAlign 에 맡기면, 배율이 커져도 잘리는 대신 다음 줄로 넘어간다.
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: SUBTITLE_SIZE,
    color: colors.textSecondary,
    fontFamily: textFontFamily(weight.regular),
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
    fontFamily: textFontFamily(weight.regular),
  },
  termsLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // 글꼴 배율이 커지면 두 링크가 한 줄에 못 들어간다. 접히게 두지 않으면
    // 두 번째 줄이 잘려 '이용약' 처럼 보인다.
    flexWrap: 'wrap',
    gap: space[5],
  },
  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    minHeight: size.touchMin,
  },
  consentBox: {
    width: CONSENT_BOX,
    height: CONSENT_BOX,
    borderRadius: radius.sm,
    borderWidth: border.chip,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentBoxOn: { backgroundColor: colors.actionFill },
  consentLabel: {
    // 글자 측정 폭 대신 체크박스를 제외한 실제 가용 폭으로 줄바꿈한다.
    flex: 1,
    minWidth: 0,
    fontSize: type.caption,
    lineHeight: line.micro,
    color: colors.textMuted,
    fontFamily: textFontFamily(weight.regular),
  },
  termsLinkTarget: {
    minHeight: size.touchMin,
    justifyContent: 'center',
    // 안드로이드의 내용 폭 측정에 기대지 않고 각 링크에 가용 폭을 나눠 준다.
    flex: 1,
    minWidth: 0,
  },
  authMessage: {
    fontSize: type.caption,
    lineHeight: line.micro,
    color: colors.error,
    textAlign: 'center',
    fontFamily: textFontFamily(weight.medium),
  },
  termsLink: { textDecorationLine: 'underline' },
  testLogin: {
    marginTop: space[6],
    paddingTop: space[6],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineStrong,
  },
  testLoginTitle: {
    fontSize: type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: textFontFamily(weight.bold),
  },
});

export default function LoginScreen(): React.JSX.Element {
  const LABEL = useLabels(LOGIN_LABEL);
  const LEGAL_LABEL = useLabels(LEGAL_DOCUMENT_LABELS_BY_LOCALE);
  const { callbackFailed, sessionExpired = false } = useMobileAuthGate();
  const [signingIn, setSigningIn] = useState(false);
  // 묵시적 동의를 명시적 동의로 바꾼다 — 체크 전에는 어떤 로그인도 시작되지 않는다.
  const [agreed, setAgreed] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');

  useEffect(() => {
    if (callbackFailed) setAuthMessage(LABEL.kakaoError);
    else if (sessionExpired) setAuthMessage(LABEL.sessionExpired);
    // LABEL 은 의존성에 넣지 않는다 — 로케일 전환이 지나간 실패 문구를 되살리면 안 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackFailed, sessionExpired]);

  async function handleKakaoLogin(): Promise<void> {
    setSigningIn(true);
    setAuthMessage(null);
    try {
      const result = await signInWithKakao();
      if (result === 'CANCELED') setAuthMessage(LABEL.kakaoCanceled);
      if (result === 'NICKNAME_REQUIRED') setAuthMessage(LABEL.nicknameRequired);
    } catch {
      setAuthMessage(LABEL.kakaoError);
    } finally {
      setSigningIn(false);
    }
  }

  async function handleGoogleLogin(): Promise<void> {
    setSigningIn(true);
    setAuthMessage(null);
    try {
      const result = await signInWithGoogle();
      if (result === 'CANCELED') setAuthMessage(LABEL.kakaoCanceled);
      // NICKNAME_REQUIRED 는 카카오 동의 항목 전용이라 Google 에서는 나올 수 없다 —
      // 만약 나오면 알 수 없는 실패로 취급한다.
      if (result === 'NICKNAME_REQUIRED') setAuthMessage(LABEL.googleError);
    } catch {
      setAuthMessage(LABEL.googleError);
    } finally {
      setSigningIn(false);
    }
  }

  // 테스트 빌드 전용 — 카카오 계정 없이 수동 E2E 를 돌리기 위한 경로.
  // 릴리스 번들에서는 `__DEV__` 게이트가 UI 째로 제거한다.
  async function handleTestLogin(): Promise<void> {
    if (testAuth === null) return;
    setSigningIn(true);
    setAuthMessage(null);
    try {
      await testAuth.signInWithTestAccount(testEmail.trim(), testPassword);
    } catch {
      setAuthMessage(LABEL.testLoginError);
    } finally {
      setSigningIn(false);
    }
  }

  async function handleLegalDocument(kind: LegalDocumentKind): Promise<void> {
    setAuthMessage(null);
    try {
      await openLegalDocument(kind);
    } catch {
      setAuthMessage(LABEL.legalDocumentError);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.body}>
          <View
            style={styles.badge}
            accessible
            accessibilityRole="image"
            accessibilityLabel={LABEL.logo}
          >
            <LfBlob variant="login" tilt="blob">
              <LfPinkyLoop size="eyes" variant="solid" spark />
            </LfBlob>
          </View>

          <Text style={styles.wordmark}>{LABEL.wordmark}</Text>
          <Text style={styles.subtitle}>{LABEL.subtitle}</Text>
          {/* 여백은 화면의 몫이다. 컴포넌트는 style 을 받지 않아 디자인 값이 새지 않는다. */}
          <View style={styles.hook}>
            <LfNotice label={LABEL.hook} />
          </View>
        </View>

        <View style={styles.actions}>
          <LfStack gap={6}>
            <LfButton
              variant="kakao"
              size="cta"
              block
              label={LABEL.kakaoCta}
              disabled={signingIn || !agreed}
              onPress={() => void handleKakaoLogin()}
            />
            <LfButton
              variant="google"
              size="cta"
              block
              leading={<GoogleMark />}
              label={LABEL.googleCta}
              disabled={signingIn || !agreed}
              onPress={() => void handleGoogleLogin()}
            />
            {authMessage !== null && (
              <Text accessibilityRole="alert" style={styles.authMessage}>
                {authMessage}
              </Text>
            )}
            <View style={styles.termsLinks}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={LEGAL_LABEL.TERMS}
                style={styles.termsLinkTarget}
                onPress={() => void handleLegalDocument('TERMS')}
              >
                <Text style={[styles.terms, styles.termsLink]}>{LEGAL_LABEL.TERMS}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={LEGAL_LABEL.PRIVACY}
                style={styles.termsLinkTarget}
                onPress={() => void handleLegalDocument('PRIVACY')}
              >
                <Text style={[styles.terms, styles.termsLink]}>{LEGAL_LABEL.PRIVACY}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel={LABEL.legalConsent}
              style={styles.consent}
              onPress={() => {
                setAgreed((prev) => !prev);
                setAuthMessage(null);
              }}
            >
              {/* check_box 계열은 아이콘 서브셋에 없다. 사각 테두리 + check 조합으로 만든다. */}
              <View style={[styles.consentBox, agreed && styles.consentBoxOn]}>
                {agreed && <LfIcon name="check" size={CONSENT_MARK} color="onAction" />}
              </View>
              <Text style={styles.consentLabel}>{LABEL.legalConsent}</Text>
            </Pressable>
          </LfStack>
          {__DEV__ && (
            <View style={styles.testLogin}>
              <LfStack gap={4}>
                <Text style={styles.testLoginTitle}>{LABEL.testLoginTitle}</Text>
                <LfInput
                  accessibilityLabel={LABEL.testLoginEmail}
                  placeholder={LABEL.testLoginEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={testEmail}
                  onChangeText={setTestEmail}
                />
                <LfInput
                  accessibilityLabel={LABEL.testLoginPassword}
                  placeholder={LABEL.testLoginPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  value={testPassword}
                  onChangeText={setTestPassword}
                />
                <LfButton
                  variant="outlined"
                  block
                  label={LABEL.testLoginSubmit}
                  disabled={signingIn || testEmail.trim() === '' || testPassword === ''}
                  onPress={() => void handleTestLogin()}
                />
              </LfStack>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
