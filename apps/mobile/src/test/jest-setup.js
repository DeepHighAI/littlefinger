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

// AsyncStorage 네이티브 모듈은 jest 환경에 없다 — 공식 in-memory mock 을 전역으로 쓴다.
// 감지·저장 로직을 검증하는 테스트는 파일 단위 jest.mock 이 이 기본값을 덮는다.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-localization 도 네이티브 상수를 읽는다. 기본은 한국어 기기다.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'ko-KR' }],
}));
