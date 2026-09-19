// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // The .worktrees/ directory holds sibling git worktrees. Linting them
    // double-counts every problem and reports on code owned by another branch.
    // docs/history holds frozen characterization snapshots of removed code
    // (e.g. the pre-redesign VideoPlayer root); their relative imports no
    // longer resolve from their archived location, which is expected.
    ignores: ['dist/*', '.worktrees/**', '.baseline-export/**', 'docs/history/**'],
  },
  {
    // Size guard (docs/size-optimization): the @expo/vector-icons barrel
    // requires every icon family eagerly and bundles all 15 fonts (4 MB).
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@expo/vector-icons',
              message:
                'Import the family directly, e.g. `import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"`, so only the fonts you use are bundled.',
            },
            { name: 'expo-audio', message: 'Removed for size (docs/size-optimization); zero import sites, expo-video owns audio playback.' },
            { name: 'expo-linear-gradient', message: 'Removed for size (docs/size-optimization); zero import sites.' },
            { name: 'expo-web-browser', message: 'Removed for size (docs/size-optimization); zero import sites.' },
            { name: '@react-native-community/slider', message: 'Removed for size (docs/size-optimization); the player ProgressBar is custom.' },
            { name: 'react-native-paper', message: 'Removed for size (docs/size-optimization); use existing components/ui.' },
            { name: 'react-native-calendars', message: 'Removed for size (docs/size-optimization); zero import sites.' },
            { name: 'react-native-collapsible', message: 'Removed for size (docs/size-optimization); zero import sites.' },
          ],
        },
      ],
    },
  },
]);
