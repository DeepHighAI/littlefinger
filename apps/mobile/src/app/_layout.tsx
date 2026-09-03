import { useFonts } from 'expo-font';
import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LocaleProvider } from '../lib/locale-native';
import { MobileAuthGateContext } from '../lib/mobile-auth-gate.ts';
import { consumeIntentionalSignOut } from '../lib/intentional-sign-out.ts';
import {
  restoreAndroidPushNavigationNative,
  startAndroidPushNavigationNative,
} from '../lib/push-navigation-native.ts';
import type { PushRoute } from '../lib/push-navigation.ts';
import { startMobileSessionGateNative } from '../lib/session-gate-native.ts';
import { loadMinimumAppVersionNative } from '../lib/minimum-app-version-native.ts';
import { readOnboardingCompletionNative } from '../lib/onboarding-native.ts';
import { FONT_ASSETS } from '../theme/fontAssets';

// 폰트가 준비되기 전에 화면이 뜨면 시스템 폰트로 한 번 그렸다가 바뀌어 깜빡인다.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element {
  const [loaded, error] = useFonts(FONT_ASSETS);
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [callbackFailed, setCallbackFailed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [startupReady, setStartupReady] = useState(false);
  // 로케일 확정 전에 스플래시가 걷히면 언어가 바뀌며 깜빡인다.
  const [localeReady, setLocaleReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [updateRequired, setUpdateRequired] = useState(false);
  const onOnboardingCompleted = useCallback(() => setOnboardingComplete(true), []);
  const authenticatedRoutesReadyRef = useRef(false);
  const hadSessionRef = useRef(false);
  // 콜드 스타트 푸시 복구의 결과(E2E Run 1 F4). settled 전에는 홈 교체를 미룬다.
  const [pushRestoreSettled, setPushRestoreSettled] = useState(false);
  const restoredToPushRef = useRef(false);
  const routerRef = useRef(router);
  routerRef.current = router;
  const routerReady = typeof rootNavigationState?.key === 'string';
  const navigate = useCallback((route: PushRoute): void => {
    routerRef.current.push(route);
  }, []);

  useEffect(
    () =>
      startMobileSessionGateNative({
        onSession: (nextSession) => {
          if (nextSession === null) authenticatedRoutesReadyRef.current = false;
          if (
            nextSession === null &&
            hadSessionRef.current &&
            !consumeIntentionalSignOut()
          ) {
            setSessionExpired(true);
          }
          if (nextSession !== null) {
            hadSessionRef.current = true;
            setSessionExpired(false);
          }
          setSession(nextSession);
          if (nextSession !== null) setCallbackFailed(false);
        },
        onReady: () => setSessionReady(true),
        onCallbackError: () => setCallbackFailed(true),
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      readOnboardingCompletionNative(),
      loadMinimumAppVersionNative(),
    ]).then(([completed, required]) => {
      if (!active) return;
      setOnboardingComplete(completed);
      setUpdateRequired(required);
      setStartupReady(true);
    }).catch(() => {
      // 두 읽기 모두 자체적으로 fail-open 이지만, 여기서 거부되면 스플래시가 영원히 남는다.
      // 공개 사용자에게 무한 로딩보다는 로그인 화면이 낫다(저장소 장애 = 온보딩 완료 취급).
      if (!active) return;
      setOnboardingComplete(true);
      setUpdateRequired(false);
      setStartupReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!routerReady || !sessionReady || !startupReady) return;
    if (updateRequired) {
      if (pathname !== '/update-required') router.replace('/update-required');
      return;
    }
    if (session === null && !onboardingComplete && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
    // 세션이 사라지면(로그아웃·탈퇴) 보호 화면에서 로그인으로 보낸다. 아래 로그인 방향
    // 규칙의 역방향 — 이 규칙이 없으면 같은 폴백이 update-required 로 떨어져 로그아웃이
    // "업데이트 후 이용해 주세요"로 보였다(E2E Run 1 F5). auth-callback 과 초대 앱링크는
    // 세션 없이도 머물러야 하는 화면이라 제외한다.
    if (
      session === null &&
      onboardingComplete &&
      pathname !== '/' &&
      pathname !== '/onboarding' &&
      pathname !== '/auth-callback' &&
      !pathname.startsWith('/i/')
    ) {
      router.replace('/');
    }
    // 세션이 생기면 게스트 화면에서 홈으로 보낸다. 이 규칙이 없으면 Stack.Protected 의
    // 폴백이 **가드 없는 첫 화면인 update-required** 로 떨어진다 — 로그인 직후와
    // 세션 보유 재실행 모두에서 재현되는, 차단처럼 보이는 라우팅 오류였다.
    // 단, 콜드 스타트 푸시 복구가 끝나기 전에는 양보한다 — 복구가 연 화면을 stale한
    // pathname 기준의 홈 교체가 덮어쓰는 것이 E2E Run 1 F4 였다.
    if (
      session !== null &&
      (pathname === '/' || pathname === '/onboarding' || pathname === '/update-required') &&
      pushRestoreSettled &&
      !restoredToPushRef.current
    ) {
      router.replace('/home');
    }
  }, [onboardingComplete, pathname, pushRestoreSettled, router, routerReady, session, sessionReady, startupReady, updateRequired]);

  useEffect(() => {
    if (!routerReady) return;

    return startAndroidPushNavigationNative({
      areProtectedRoutesReady: () => authenticatedRoutesReadyRef.current,
      navigate,
      logError: (pushError) => console.error('푸시 알림 처리에 실패했습니다.', pushError),
    });
  }, [navigate, routerReady]);

  useEffect(() => {
    const authenticatedRoutesReady = session !== null && routerReady;
    authenticatedRoutesReadyRef.current = authenticatedRoutesReady;
    if (!authenticatedRoutesReady) {
      setPushRestoreSettled(false);
      restoredToPushRef.current = false;
      return;
    }

    void restoreAndroidPushNavigationNative(navigate)
      .then((navigated) => {
        restoredToPushRef.current = navigated;
      })
      .catch((pushError: unknown) => {
        console.error('저장된 푸시 목적지 복구에 실패했습니다.', pushError);
      })
      .finally(() => {
        setPushRestoreSettled(true);
      });

    return () => {
      authenticatedRoutesReadyRef.current = false;
    };
  }, [navigate, routerReady, session]);

  useEffect(() => {
    // 폰트·저장 세션·로케일을 모두 확인한 뒤 숨긴다. 뒤에서는 Stack이 첫 렌더부터 유지된다.
    if ((loaded || error) && sessionReady && startupReady && localeReady) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error, sessionReady, startupReady, localeReady]);

  // 화면 헤더는 각 화면이 직접 그린다(디자인 원본에 맞추기 위해).
  return (
    <MobileAuthGateContext.Provider value={{ callbackFailed, sessionExpired, onOnboardingCompleted }}>
      <LocaleProvider onReady={() => setLocaleReady(true)}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="update-required" />
        <Stack.Screen name="i/[token]" />
        {/* 어긋난 딥링크는 세션과 무관하게 떠야 한다 — 가드 밖에 둔다. */}
        <Stack.Screen name="+not-found" />
        <Stack.Protected guard={session === null}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth-callback" />
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={session !== null}>
          <Stack.Screen name="home" />
          <Stack.Screen name="history" />
          <Stack.Screen name="promise/edit" />
          <Stack.Screen name="promise/[promise_id]" />
          <Stack.Screen name="invite" />
          <Stack.Screen name="fulfillment/[promise_id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="profile-nickname" />
          <Stack.Screen name="blocked-users" />
        </Stack.Protected>
      </Stack>
      </LocaleProvider>
    </MobileAuthGateContext.Provider>
  );
}
