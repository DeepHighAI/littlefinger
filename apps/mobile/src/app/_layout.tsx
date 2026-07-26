import { Stack } from 'expo-router';

// 화면 헤더는 각 화면이 LfAppBar 로 직접 그린다(디자인 원본에 맞추기 위해).
// 그래서 Stack 의 기본 헤더는 끈다.
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
