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
          ],
        },
      ],
    },
  },
]);
