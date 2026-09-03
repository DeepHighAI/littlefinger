// jest-expo 프리셋 — RN 트랜스폼과 Expo 모듈 모킹이 여기 들어 있다.
// packages/shared 는 Vitest 로 돈다(러너 분리는 PO 결정 2026-07-26).
//
// @testing-library/react-native 13+ 는 matcher 가 내장이라 setup 파일이 필요 없다.
module.exports = {
  preset: 'jest-expo',
  // Worklets 0.10 ships native/non-native twins. Jest must resolve the non-native mock path.
  resolver: 'react-native-worklets/jest/resolver',
  // RN 렌더러 15개가 동시에 뜨면 5초 테스트 제한이 CPU 경합으로 무작위 실패한다.
  // 러너는 개발 머신보다 코어가 적어 4 도 과하다.
  maxWorkers: process.env.CI ? 2 : 4,
  // 경합이 남아도 렌더 대기가 벽시계 제한에 먼저 걸리지 않게 한다.
  testTimeout: 20_000,
  setupFilesAfterEnv: ['<rootDir>/src/test/jest-setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@littlefinger/.*))',
  ],
};
