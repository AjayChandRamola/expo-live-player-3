module.exports = function (api) {
  api.cache(true);
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
  };
};
