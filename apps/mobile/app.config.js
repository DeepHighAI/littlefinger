const { resolveAdMobBuildConfig } = require('./config/admob-config.js');

function resolveAppLinkIntentFilters(webBaseUrl) {
  try {
    const url = new URL(webBaseUrl);
    if (url.protocol !== 'https:' || url.hostname === 'localhost') return [];
    return [{
      action: 'VIEW',
      autoVerify: true,
      category: ['BROWSABLE', 'DEFAULT'],
      data: [{ scheme: 'https', host: url.hostname, pathPrefix: '/i/' }],
    }];
  } catch {
    return [];
  }
}

module.exports = ({ config }) => {
  const admob = resolveAdMobBuildConfig(process.env);
  const adPlugin = [
    'react-native-google-mobile-ads',
    {
      androidAppId: admob.androidAppId,
      delayAppMeasurementInit: true,
    },
  ];
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'react-native-google-mobile-ads';
  });
  return {
    ...config,
    android: {
      ...config.android,
      intentFilters: resolveAppLinkIntentFilters(process.env.EXPO_PUBLIC_WEB_BASE_URL ?? ''),
    },
    plugins: [...plugins, adPlugin],
    extra: {
      ...config.extra,
      admob: {
        nativeUnitId: admob.nativeUnitId,
        bannerUnitId: admob.bannerUnitId,
        rewardedWitnessUnitId: admob.rewardedWitnessUnitId,
        rewardedDurationUnitId: admob.rewardedDurationUnitId,
        rewardedRetentionUnitId: admob.rewardedRetentionUnitId,
      },
    },
  };
};

module.exports.resolveAppLinkIntentFilters = resolveAppLinkIntentFilters;
