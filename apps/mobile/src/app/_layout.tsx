import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { MobileAuthGateContext } from '../lib/mobile-auth-gate.ts';
import { startMobileSessionGateNative } from '../lib/session-gate-native.ts';
import { FONT_ASSETS } from '../theme/fontAssets';

// 폰트가 준비되기 전에 화면이 뜨면 시스템 폰트로 한 번 그렸다가 바뀌어 깜빡인다.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element {
  const [loaded, error] = useFonts(FONT_ASSETS);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [callbackFailed, setCallbackFailed] = useState(false);

  useEffect(
    () =>
      startMobileSessionGateNative({
        onSession: (nextSession) => {
          setSession(nextSession);
          if (nextSession !== null) setCallbackFailed(false);
        },
        onReady: () => setSessionReady(true),
        onCallbackError: () => setCallbackFailed(true),
      }),
    [],
  );

  useEffect(() => {
    // 폰트와 저장 세션을 모두 확인한 뒤 숨긴다. 뒤에서는 Stack이 첫 렌더부터 유지된다.
    if ((loaded || error) && sessionReady) void SplashScreen.hideAsync();
  }, [loaded, error, sessionReady]);

  // 화면 헤더는 각 화면이 직접 그린다(디자인 원본에 맞추기 위해).
  return (
    <MobileAuthGateContext.Provider value={{ callbackFailed }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={session === null}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth-callback" />
        </Stack.Protected>
        <Stack.Protected guard={session !== null}>
          <Stack.Screen name="home" />
          <Stack.Screen name="promise/edit" />
          <Stack.Screen name="invite" />
          <Stack.Screen name="fulfillment/[promise_id]" />
        </Stack.Protected>
      </Stack>
    </MobileAuthGateContext.Provider>
  );
}
