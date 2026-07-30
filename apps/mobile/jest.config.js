// jest-expo 프리셋 — RN 트랜스폼과 Expo 모듈 모킹이 여기 들어 있다.
// packages/shared 는 Vitest 로 돈다(러너 분리는 PO 결정 2026-07-26).
//
// @testing-library/react-native 13+ 는 matcher 가 내장이라 setup 파일이 필요 없다.
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/jest-setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@littlefinger/.*))',
  ],
};
