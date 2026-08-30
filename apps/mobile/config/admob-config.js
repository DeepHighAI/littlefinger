const GOOGLE_TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_TEST_NATIVE_UNIT_ID = 'ca-app-pub-3940256099942544/2247696110';
const GOOGLE_TEST_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741';
const GOOGLE_TEST_REWARDED_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/u;
const UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/u;

function configured(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function resolveAdMobBuildConfig(env) {
  const production = env.EAS_BUILD_PROFILE === 'production';
  const configuredAppId = configured(env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID);
  const nativeUnitId = configured(env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID);
  const bannerUnitId = configured(env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID);
  const rewardedWitnessUnitId = configured(env.EXPO_PUBLIC_ADMOB_REWARDED_WITNESS_UNIT_ID);
  const rewardedDurationUnitId = configured(env.EXPO_PUBLIC_ADMOB_REWARDED_DURATION_UNIT_ID);
  const rewardedRetentionUnitId = configured(env.EXPO_PUBLIC_ADMOB_REWARDED_RETENTION_UNIT_ID);

  if (!production) {
    return {
      androidAppId: GOOGLE_TEST_ANDROID_APP_ID,
      nativeUnitId: GOOGLE_TEST_NATIVE_UNIT_ID,
      bannerUnitId: GOOGLE_TEST_BANNER_UNIT_ID,
      rewardedWitnessUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
      rewardedDurationUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
      rewardedRetentionUnitId: GOOGLE_TEST_REWARDED_UNIT_ID,
      production: false,
    };
  }

  if (configuredAppId === null || !APP_ID_PATTERN.test(configuredAppId)) {
    throw new Error('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID must be a valid production AdMob App ID.');
  }
  if (nativeUnitId === null || !UNIT_ID_PATTERN.test(nativeUnitId)) {
    throw new Error('EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID must be a valid production native Ad Unit ID.');
  }
  for (const [name, value] of [
    ['EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID', bannerUnitId],
    ['EXPO_PUBLIC_ADMOB_REWARDED_WITNESS_UNIT_ID', rewardedWitnessUnitId],
    ['EXPO_PUBLIC_ADMOB_REWARDED_DURATION_UNIT_ID', rewardedDurationUnitId],
    ['EXPO_PUBLIC_ADMOB_REWARDED_RETENTION_UNIT_ID', rewardedRetentionUnitId],
  ]) {
    if (value === null || !UNIT_ID_PATTERN.test(value)) {
      throw new Error(`${name} must be a valid production Ad Unit ID.`);
    }
  }

  return {
    androidAppId: configuredAppId,
    nativeUnitId,
    bannerUnitId,
    rewardedWitnessUnitId,
    rewardedDurationUnitId,
    rewardedRetentionUnitId,
    production: true,
  };
}

module.exports = {
  GOOGLE_TEST_ANDROID_APP_ID,
  GOOGLE_TEST_NATIVE_UNIT_ID,
  GOOGLE_TEST_BANNER_UNIT_ID,
  GOOGLE_TEST_REWARDED_UNIT_ID,
  resolveAdMobBuildConfig,
};
