import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEGAL_DOCUMENT_LABELS, type LegalDocumentKind } from '@littlefinger/shared';

import { LfButton } from '../components/LfButton';
import { LfInput } from '../components/LfInput';
import { LfNotice } from '../components/LfNotice';
import { LfPinky } from '../components/LfPinky';
import { LfStack } from '../components/LfStack';
import {
  signInWithKakao,
} from '../lib/kakao-auth-native.ts';
import { signInWithTestAccount } from '../lib/test-auth-native.ts';
import { openLegalDocument } from '../lib/legal-native.ts';
import { useMobileAuthGate } from '../lib/mobile-auth-gate.ts';
import { brandFontFamily } from '../theme/fonts';
import { colors, line, size, space, type, weight } from '../theme/tokens';

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
const KAKAO_LOGIN_CANCELED_LABEL = '로그인을 취소했습니다. 다시 시도해 주세요.';
const KAKAO_LOGIN_ERROR_LABEL =
  '지금 카카오 로그인이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.';
const KAKAO_NICKNAME_REQUIRED_LABEL =
  '닉네임 정보는 약속 기록에 꼭 필요합니다. 동의 후 이용해 주세요.';
const SESSION_EXPIRED_LABEL = '다시 로그인해 주세요.';
const LEGAL_DOCUMENT_ERROR_LABEL =
  '법적 문서를 열 수 없습니다. 잠시 후 다시 시도해 주세요.';
const LEGAL_AGREEMENT_LABEL = '시작하면 위 문서에 동의하게 돼요';
const LOGIN_LOGO_LABEL = '리틀핑거 로고';
const TEST_LOGIN_TITLE_LABEL = '테스트 로그인 (개발 빌드 전용)';
const TEST_LOGIN_EMAIL_LABEL = '테스트 이메일';
const TEST_LOGIN_PASSWORD_LABEL = '테스트 비밀번호';
const TEST_LOGIN_SUBMIT_LABEL = '테스트 계정으로 로그인';
const TEST_LOGIN_ERROR_LABEL = '테스트 로그인에 실패했습니다. 계정 정보를 확인해 주세요.';

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
  termsLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[5],
  },
  termsLinkTarget: {
    minHeight: size.touchMin,
    justifyContent: 'center',
  },
  authMessage: {
    fontSize: type.caption,
    lineHeight: line.micro,
    color: colors.error,
    textAlign: 'center',
    fontFamily: brandFontFamily(weight.medium),
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
    fontFamily: brandFontFamily(weight.bold),
  },
});

export default function LoginScreen(): React.JSX.Element {
  const { callbackFailed, sessionExpired = false } = useMobileAuthGate();
  const [signingIn, setSigningIn] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');

  useEffect(() => {
    if (callbackFailed) setAuthMessage(KAKAO_LOGIN_ERROR_LABEL);
    else if (sessionExpired) setAuthMessage(SESSION_EXPIRED_LABEL);
  }, [callbackFailed, sessionExpired]);

  async function handleKakaoLogin(): Promise<void> {
    setSigningIn(true);
    setAuthMessage(null);
    try {
      const result = await signInWithKakao();
      if (result === 'CANCELED') setAuthMessage(KAKAO_LOGIN_CANCELED_LABEL);
      if (result === 'NICKNAME_REQUIRED') setAuthMessage(KAKAO_NICKNAME_REQUIRED_LABEL);
    } catch {
      setAuthMessage(KAKAO_LOGIN_ERROR_LABEL);
    } finally {
      setSigningIn(false);
    }
  }

  // 테스트 빌드 전용 — 카카오 계정 없이 수동 E2E 를 돌리기 위한 경로.
  // 릴리스 번들에서는 `__DEV__` 게이트가 UI 째로 제거한다.
  async function handleTestLogin(): Promise<void> {
    setSigningIn(true);
    setAuthMessage(null);
    try {
      await signInWithTestAccount(testEmail.trim(), testPassword);
    } catch {
      setAuthMessage(TEST_LOGIN_ERROR_LABEL);
    } finally {
      setSigningIn(false);
    }
  }

  async function handleLegalDocument(kind: LegalDocumentKind): Promise<void> {
    setAuthMessage(null);
    try {
      await openLegalDocument(kind);
    } catch {
      setAuthMessage(LEGAL_DOCUMENT_ERROR_LABEL);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <View
          style={styles.badge}
          accessible
          accessibilityRole="image"
          accessibilityLabel={LOGIN_LOGO_LABEL}
        >
          <LfPinky size="xl" tone="onContainer" />
        </View>

        <Text style={styles.wordmark}>리틀핑거</Text>
        <Text style={styles.subtitle}>새끼손가락 걸고, 약속!</Text>
        {/* 여백은 화면의 몫이다. 컴포넌트는 style 을 받지 않아 디자인 값이 새지 않는다. */}
        <View style={styles.hook}>
          <LfNotice label="오늘도 새끼손가락 걸어볼까요?" />
        </View>
      </View>

      <View style={styles.actions}>
        <LfStack gap={6}>
          <LfButton
            variant="kakao"
            size="cta"
            block
            label="카카오로 시작하기"
            disabled={signingIn}
            onPress={() => void handleKakaoLogin()}
          />
          {authMessage !== null && (
            <Text accessibilityRole="alert" style={styles.authMessage}>
              {authMessage}
            </Text>
          )}
          <View style={styles.termsLinks}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={LEGAL_DOCUMENT_LABELS.TERMS}
              style={styles.termsLinkTarget}
              onPress={() => void handleLegalDocument('TERMS')}
            >
              <Text style={[styles.terms, styles.termsLink]}>{LEGAL_DOCUMENT_LABELS.TERMS}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={LEGAL_DOCUMENT_LABELS.PRIVACY}
              style={styles.termsLinkTarget}
              onPress={() => void handleLegalDocument('PRIVACY')}
            >
              <Text style={[styles.terms, styles.termsLink]}>{LEGAL_DOCUMENT_LABELS.PRIVACY}</Text>
            </Pressable>
          </View>
          <Text style={styles.terms}>{LEGAL_AGREEMENT_LABEL}</Text>
        </LfStack>
        {__DEV__ && (
          <View style={styles.testLogin}>
            <LfStack gap={4}>
              <Text style={styles.testLoginTitle}>{TEST_LOGIN_TITLE_LABEL}</Text>
              <LfInput
                accessibilityLabel={TEST_LOGIN_EMAIL_LABEL}
                placeholder={TEST_LOGIN_EMAIL_LABEL}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={testEmail}
                onChangeText={setTestEmail}
              />
              <LfInput
                accessibilityLabel={TEST_LOGIN_PASSWORD_LABEL}
                placeholder={TEST_LOGIN_PASSWORD_LABEL}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={testPassword}
                onChangeText={setTestPassword}
              />
              <LfButton
                variant="outlined"
                block
                label={TEST_LOGIN_SUBMIT_LABEL}
                disabled={signingIn || testEmail.trim() === '' || testPassword === ''}
                onPress={() => void handleTestLogin()}
              />
            </LfStack>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
