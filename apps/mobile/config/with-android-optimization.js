const RELEASE_PROPERTIES = [
  'android.enableMinifyInReleaseBuilds',
  'android.enableShrinkResourcesInReleaseBuilds',
  'android.r8.optimizedResourceShrinking',
];

function optimizeAppBuildGradle(contents) {
  const optimized = contents.replaceAll('proguard-android.txt', 'proguard-android-optimize.txt');
  // SDK 템플릿이 바뀌면 최적화가 빠진 채 배포되지 않도록 빌드를 중단한다.
  if (!optimized.includes('getDefaultProguardFile("proguard-android-optimize.txt")') &&
      !optimized.includes("getDefaultProguardFile('proguard-android-optimize.txt')")) {
    throw new Error('Android release optimization requires the default optimized ProGuard rules.');
  }
  return optimized;
}

function optimizeGradleProperties(properties) {
  return [
    ...properties.filter((item) => item.type !== 'property' || !RELEASE_PROPERTIES.includes(item.key)),
    ...RELEASE_PROPERTIES.map((key) => ({ type: 'property', key, value: 'true' })),
  ];
}

module.exports = (config) => {
  const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');
  config = withGradleProperties(config, (mod) => {
    mod.modResults = optimizeGradleProperties(mod.modResults);
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = optimizeAppBuildGradle(mod.modResults.contents);
    return mod;
  });
};

module.exports.optimizeAppBuildGradle = optimizeAppBuildGradle;
module.exports.optimizeGradleProperties = optimizeGradleProperties;
