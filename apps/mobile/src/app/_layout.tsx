import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { FONT_ASSETS } from '../theme/fontAssets';

// 폰트가 준비되기 전에 화면이 뜨면 시스템 폰트로 한 번 그렸다가 바뀌어 깜빡인다.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element | null {
  const [loaded, error] = useFonts(FONT_ASSETS);

  useEffect(() => {
    // 로드에 실패해도 스플래시에 갇히면 안 된다. 시스템 폰트로라도 화면은 띄운다.
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  // 화면 헤더는 각 화면이 직접 그린다(디자인 원본에 맞추기 위해).
  return <Stack screenOptions={{ headerShown: false }} />;
}
