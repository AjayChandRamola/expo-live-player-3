// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // The .worktrees/ directory holds sibling git worktrees. Linting them
    // double-counts every problem and reports on code owned by another branch.
    ignores: ['dist/*', '.worktrees/**', '.baseline-export/**'],
  },
]);
