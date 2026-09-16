// jest.web.config.js
// Second Jest project for platform adapters' .web.ts implementations.
// The default project (package.json "jest") resolves .native.ts files.
module.exports = {
  preset: "jest-expo/web",
  testEnvironment: "jsdom",
  testMatch: ["**/__tests__/player/platform/*.web.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/harness/setup.web.ts"],
  moduleNameMapper: {
    "\.svg$": "<rootDir>/__mocks__/svgMock.js",
  },
};
