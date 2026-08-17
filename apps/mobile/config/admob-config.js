const GOOGLE_TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_TEST_NATIVE_UNIT_ID = 'ca-app-pub-3940256099942544/2247696110';
const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/u;
const UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/u;

function configured(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function resolveAdMobBuildConfig(env) {
  const production = env.EAS_BUILD_PROFILE === 'production';
  const configuredAppId = configured(env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID);
  const nativeUnitId = configured(env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID);

  if (production && (configuredAppId === null || !APP_ID_PATTERN.test(configuredAppId))) {
    throw new Error('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID must be a valid production AdMob App ID.');
  }
  if (production && (nativeUnitId === null || !UNIT_ID_PATTERN.test(nativeUnitId))) {
    throw new Error('EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID must be a valid production native Ad Unit ID.');
  }

  return {
    androidAppId: configuredAppId ?? GOOGLE_TEST_ANDROID_APP_ID,
    nativeUnitId: nativeUnitId ?? GOOGLE_TEST_NATIVE_UNIT_ID,
    production,
  };
}

module.exports = {
  GOOGLE_TEST_ANDROID_APP_ID,
  GOOGLE_TEST_NATIVE_UNIT_ID,
  resolveAdMobBuildConfig,
};
