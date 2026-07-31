import { Redirect } from 'expo-router';

export default function AuthCallbackScreen(): React.JSX.Element {
  // 세션 교환은 루트 게이트가 맡고, 이 라우트는 딥링크가 404 화면으로 빠지는 것만 막는다.
  return <Redirect href="/" />;
}
