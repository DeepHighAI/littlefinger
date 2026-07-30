// Expo 패치 업데이트 뒤 벡터 아이콘이 테스트에서 실제 폰트 asset을 읽으려 하면 네이티브
// registry가 없어 실패한다. 화면 테스트는 글리프 파일이 아니라 wrapper 계약을 검증한다.
jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    __esModule: true,
    default: ({ color, name, size, ...rest }) =>
      React.createElement(Text, { ...rest, style: { color, fontSize: size } }, name),
  };
});
