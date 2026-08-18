import { useFonts } from 'expo-font';
import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [updateRequired, setUpdateRequired] = useState(false);
  const authenticatedRoutesReadyRef = useRef(false);
  const hadSessionRef = useRef(false);
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
  }, [onboardingComplete, pathname, router, routerReady, session, sessionReady, startupReady, updateRequired]);

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
    if (!authenticatedRoutesReady) return;

    void restoreAndroidPushNavigationNative(navigate).catch((pushError: unknown) => {
      console.error('저장된 푸시 목적지 복구에 실패했습니다.', pushError);
    });

    return () => {
      authenticatedRoutesReadyRef.current = false;
    };
  }, [navigate, routerReady, session]);

  useEffect(() => {
    // 폰트와 저장 세션을 모두 확인한 뒤 숨긴다. 뒤에서는 Stack이 첫 렌더부터 유지된다.
    if ((loaded || error) && sessionReady && startupReady) void SplashScreen.hideAsync();
  }, [loaded, error, sessionReady, startupReady]);

  // 화면 헤더는 각 화면이 직접 그린다(디자인 원본에 맞추기 위해).
  return (
    <MobileAuthGateContext.Provider value={{ callbackFailed, sessionExpired }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="update-required" />
        <Stack.Screen name="i/[token]" />
        <Stack.Protected guard={session === null}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth-callback" />
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={session !== null}>
          <Stack.Screen name="home" />
          <Stack.Screen name="promise/edit" />
          <Stack.Screen name="promise/[promise_id]" />
          <Stack.Screen name="invite" />
          <Stack.Screen name="fulfillment/[promise_id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="profile-nickname" />
        </Stack.Protected>
      </Stack>
    </MobileAuthGateContext.Provider>
  );
}
