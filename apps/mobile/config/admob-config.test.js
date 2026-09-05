const {
  GOOGLE_TEST_ANDROID_APP_ID,
  GOOGLE_TEST_BANNER_UNIT_ID,
  GOOGLE_TEST_NATIVE_UNIT_ID,
  GOOGLE_TEST_REWARDED_UNIT_ID,
  resolveAdMobBuildConfig,
} = require('./admob-config.js');
const appConfig = require('../app.config.js');

describe('F-12 AdMob build configuration', () => {
  test('development uses only the documented Google test App ID', () => {
    expect(resolveAdMobBuildConfig({
      EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
      EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID: 'ca-app-pub-1234567890123456/1234567890',
      EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: 'ca-app-pub-1234567890123456/2234567890',
      EXPO_PUBLIC_ADMOB_REWARDED_WITNESS_UNIT_ID: 'ca-app-pub-1234567890123456/3234567890',
      EXPO_PUBLIC_ADMOB_REWARDED_DURATION_UNIT_ID: 'ca-app-pub-1234567890123456/4234567890',
      EXPO_PUBLIC_ADMOB_REWARDED_RETENTION_UNIT_ID: 'ca-app-pub-1234567890123456/5234567890',
    })).toEqual({
      androidAppId: GOOGLE_TEST_ANDROID_APP_ID,
      nativeUnitId: GOOGLE_TEST_NATIVE_UNIT_ID,
      bannerUnitId: GOOGLE_TEST_BANNER_UNIT_ID,
      rewardedWitnessUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
      rewardedDurationUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
      rewardedRetentionUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
      production: false,
    });
  });

  test.each([
    [{ EAS_BUILD_PROFILE: 'production' }, 'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID'],
    [
      {
        EAS_BUILD_PROFILE: 'production',
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
      },
      'EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID',
    ],
  ])('production fails before native build when an identifier is missing', (env, missing) => {
    expect(() => resolveAdMobBuildConfig(env)).toThrow(missing);
  });

  test('production accepts separately configured App and native-unit identifiers', () => {
    expect(
      resolveAdMobBuildConfig({
        EAS_BUILD_PROFILE: 'production',
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
        EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID: 'ca-app-pub-1234567890123456/1234567890',
        EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: 'ca-app-pub-1234567890123456/2234567890',
        EXPO_PUBLIC_ADMOB_REWARDED_WITNESS_UNIT_ID: 'ca-app-pub-1234567890123456/3234567890',
        EXPO_PUBLIC_ADMOB_REWARDED_DURATION_UNIT_ID: 'ca-app-pub-1234567890123456/4234567890',
        EXPO_PUBLIC_ADMOB_REWARDED_RETENTION_UNIT_ID: 'ca-app-pub-1234567890123456/5234567890',
      }),
    ).toEqual({
      androidAppId: 'ca-app-pub-1234567890123456~1234567890',
      nativeUnitId: 'ca-app-pub-1234567890123456/1234567890',
      bannerUnitId: 'ca-app-pub-1234567890123456/2234567890',
      rewardedWitnessUnitId: 'ca-app-pub-1234567890123456/3234567890',
      rewardedDurationUnitId: 'ca-app-pub-1234567890123456/4234567890',
      rewardedRetentionUnitId: 'ca-app-pub-1234567890123456/5234567890',
      production: true,
    });
  });

  test('production rejects identifiers that are not AdMob Android formats', () => {
    expect(() =>
      resolveAdMobBuildConfig({
        EAS_BUILD_PROFILE: 'production',
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'not-an-app-id',
        EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID: 'not-an-ad-unit',
      }),
    ).toThrow('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID');
  });

  test.each([
    ['EXPO_PUBLIC_ADMOB_ANDROID_APP_ID', GOOGLE_TEST_ANDROID_APP_ID],
    ['EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID', GOOGLE_TEST_NATIVE_UNIT_ID],
    ['EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID', GOOGLE_TEST_BANNER_UNIT_ID],
    ['EXPO_PUBLIC_ADMOB_REWARDED_WITNESS_UNIT_ID', GOOGLE_TEST_REWARDED_UNIT_ID],
    ['EXPO_PUBLIC_ADMOB_REWARDED_DURATION_UNIT_ID', GOOGLE_TEST_REWARDED_UNIT_ID],
    ['EXPO_PUBLIC_ADMOB_REWARDED_RETENTION_UNIT_ID', GOOGLE_TEST_REWARDED_UNIT_ID],
  ])('production rejects the Google test publisher in %s', (name, value) => {
    const env = {
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
      EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID: 'ca-app-pub-1234567890123456/1234567890',
      EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: 'ca-app-pub-1234567890123456/2234567890',
      EXPO_PUBLIC_ADMOB_REWARDED_WITNESS_UNIT_ID: 'ca-app-pub-1234567890123456/3234567890',
      EXPO_PUBLIC_ADMOB_REWARDED_DURATION_UNIT_ID: 'ca-app-pub-1234567890123456/4234567890',
      EXPO_PUBLIC_ADMOB_REWARDED_RETENTION_UNIT_ID: 'ca-app-pub-1234567890123456/5234567890',
      [name]: value,
    };
    expect(() => resolveAdMobBuildConfig(env)).toThrow(name);
  });

  test('Expo plugin receives the native App ID and delays measurement', () => {
    const config = appConfig({
      config: {
        extra: { eas: { projectId: 'project-id' } },
        name: '리틀핑거',
        plugins: ['expo-router', 'react-native-google-mobile-ads'],
        slug: 'littlefinger',
      },
    });

    expect(config.plugins).toEqual([
      'expo-router',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: GOOGLE_TEST_ANDROID_APP_ID,
          delayAppMeasurementInit: true,
        },
      ],
    ]);
    expect(config['react-native-google-mobile-ads']).toBeUndefined();
    expect(config.extra).toEqual({
      eas: { projectId: 'project-id' },
      admob: {
        nativeUnitId: GOOGLE_TEST_NATIVE_UNIT_ID,
        bannerUnitId: GOOGLE_TEST_BANNER_UNIT_ID,
        rewardedWitnessUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
        rewardedDurationUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
        rewardedRetentionUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
      },
    });
  });
});
