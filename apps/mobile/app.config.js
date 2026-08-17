const { resolveAdMobBuildConfig } = require('./config/admob-config.js');

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
    plugins: [...plugins, adPlugin],
    extra: {
      ...config.extra,
      admob: { nativeUnitId: admob.nativeUnitId },
    },
  };
};
