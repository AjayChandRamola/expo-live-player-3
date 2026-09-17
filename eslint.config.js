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
]);
