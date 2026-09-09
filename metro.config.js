// metro.config.js (project root)
const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // Use react-native-svg-transformer so .svg imports become React components
  config.transformer.babelTransformerPath = require.resolve(
    "react-native-svg-transformer"
  );

  // Remove svg from assetExts and add it into sourceExts
  config.resolver.assetExts = config.resolver.assetExts.filter(
    (ext) => ext !== "svg"
  );
  if (!config.resolver.sourceExts.includes("svg")) {
    config.resolver.sourceExts.push("svg");
  }

  return config;
})();
