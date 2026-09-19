module.exports = function (api) {
  // Cache per NODE_ENV so the production-only plugins below are not reused
  // from a development run (expo export sets NODE_ENV=production).
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: ['babel-preset-expo'], // ✅ already includes Expo Router v6+ transforms
    plugins: [
      // ✅ Optional path aliasing for "@/..."
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
        },
      ],

      // ✅ Keep Reanimated plugin last if you use it
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        // Size guard (docs/size-optimization, C-11): strip development logging
        // from release bundles. error/warn stay: utils/Logger routes
        // observability through them.
        plugins: [['transform-remove-console', { exclude: ['error', 'warn'] }]],
      },
    },
  };
};
