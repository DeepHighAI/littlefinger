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

// Reanimated 4는 Jest에서 네이티브 worklet 런타임을 설치할 수 없다. 공식 mock은
// 애니메이션을 즉시 완료시켜 화면 계약과 reduced-motion 분기만 결정적으로 검증한다.
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  Reanimated.useReducedMotion = () => false;
  return Reanimated;
});

// 화면 테스트에는 AdMob 네이티브 브리지가 없다. 광고 SDK 자체의 동작은
// admob-loader 단위 테스트에서 주입 경계로 검증하고, 화면은 빈 호스트 컴포넌트를 쓴다.
jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Host = (props) => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: () => ({ initialize: jest.fn().mockResolvedValue(undefined) }),
    AdEventType: { CLOSED: 'closed', ERROR: 'error' },
    AdsConsent: {
      gatherConsent: jest.fn().mockResolvedValue(undefined),
      getConsentInfo: jest.fn().mockResolvedValue({ canRequestAds: true }),
    },
    BannerAd: Host,
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'adaptive' },
    NativeAd: { createForAdRequest: jest.fn().mockResolvedValue(null) },
    NativeAdView: Host,
    NativeAsset: Host,
    NativeAssetType: {
      ADVERTISER: 'advertiser',
      BODY: 'body',
      CALL_TO_ACTION: 'call_to_action',
      HEADLINE: 'headline',
      ICON: 'icon',
    },
    RewardedAd: { createForAdRequest: jest.fn() },
    RewardedAdEventType: { EARNED_REWARD: 'earned_reward', LOADED: 'loaded' },
    TestIds: { ADAPTIVE_BANNER: 'test-banner', NATIVE: 'test-native', REWARDED: 'test-rewarded' },
  };
});
