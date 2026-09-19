# Build Architecture — Current and Target

## 1. Current (verified from configuration files)

| Stage | Configuration | Notes |
|---|---|---|
| Entry | `package.json` `main: "expo-router/entry"` | Router-driven app; no custom `index.js` |
| TypeScript | `tsconfig.json` extends `expo/tsconfig.base`, `strict: true`, path alias `@/*`, excludes `node_modules`, `docs/history` | `tsc --noEmit` reports 3,068 errors (mostly Jest globals under TS 6.0.3); no `typecheck` script exists |
| Babel | `babel.config.js`: `babel-preset-expo`, `module-resolver` (`@` → `./`), `react-native-reanimated/plugin` (re-exports `react-native-worklets/plugin`); no `env` overrides | React Compiler enabled through `app.json` `experiments.reactCompiler` |
| Metro | `metro.config.js`: `expo/metro-config` default plus `react-native-svg-transformer`; `svg` moved from `assetExts` to `sourceExts` | Only customisation is for two SVG files |
| Router | `app/` file routes; `experiments.typedRoutes: true` generates `.expo/types` | `unstable_settings.anchor = "(tabs)"` |
| Expo config | `app.json` only (no `app.config.js`); plugins `expo-router`, `expo-splash-screen`; `extra` holds content-source settings; **no** `android.package`, `ios.bundleIdentifier`, `runtimeVersion`, `updates`, `jsEngine`, `newArchEnabled` (defaults apply) | Prebuild cannot run non-interactively until identifiers exist |
| Native projects | none; `/android`, `/ios` git-ignored | Managed workflow; `npm run prebuild` = `expo prebuild --clean` |
| EAS | no `eas.json`; global `eas` CLI present | No build profiles defined |
| Scripts | `test`, `test:web`, `lint`, `start`, `start:logged`, `android`, `ios`, `web`, `prebuild`, `reset-project`, `setup` (script file absent), `clean-managed`, `managed` | `setup` references `scripts/setup.js` which does not exist; `reset-project` is the template script |
| Jest | preset `jest-expo`; setup `__tests__/harness/setup.ts`; `.svg` mapped to `__mocks__/svgMock.js`; second project `jest.web.config.js` for `.web.test.ts` | 15 suites fail on the Reanimated 4 mock |
| CI | none (`.github/` absent) | Quality gates are manual |
| Production JS | `expo export` → Metro production transform (minify) → Hermes bytecode; assets copied to `assets/` with hashed names; `metadata.json` lists them | Verified by the baseline exports |

## 2. Target

| Stage | Change | Change ID |
|---|---|---|
| Babel | Add `env.production.plugins = [["transform-remove-console", { exclude: ["error", "warn"] }]]`; everything else unchanged | C-11 |
| Metro | Remove the svg transformer block; back to `expo/metro-config` defaults | C-09 |
| TypeScript | Unchanged config; runtime-source error count must not grow. (Fixing the Jest-globals errors is out of scope but recorded; D-9 decides the TypeScript version) | — |
| Expo config | Add `android.package` and `ios.bundleIdentifier` (D-1); add `expo-build-properties` plugin with Android R8 and resource shrinking on | C-03, C-14 |
| EAS | Add `eas.json` with `production` (AAB, `distribution: store`), `preview` (APK for QA, `buildType: apk`), and `development` profiles; `cli.appVersionSource: remote` or `local` per D-2 | C-03 |
| Scripts | Add `size:export` (`expo export --platform android` and `ios` to `.baseline-export/`), `size:report` (`node scripts/measure-app-size.js`), `typecheck` (`tsc --noEmit`) | C-02 |
| Jest | Add the Reanimated 4 / worklets mock setup so 95/95 suites run; remove the `.svg` mapper with C-09 | C-01, C-09 |
| Lint | Add `no-restricted-imports` for the icon barrel and for removed packages | C-08, C-19 |
| Git hygiene | `.gitignore`: add `.baseline-export/`, `.size-reports/`, `*.apks`, `*.aab`, `*.apk` | C-02 |
| Reports | `docs/size-optimization/size-budget.json` (machine-readable ceilings) checked by `measure-app-size.js --assert` | C-19 |

## 3. Production versus development separation (verified)

| Concern | Dev build | Production build | Action |
|---|---|---|---|
| `__DEV__` gates | `Logger.installGlobalErrorHandlers()` in `app/_layout.tsx`, `devLog.ts`, `analytics.track` | compiled out by Metro constant folding | none |
| Raw `console.*` (73 sites) | present | present today | C-11 removes log/info/debug |
| expo-router dev assets (`sitemap.png`, `unmatched.png`, `arrow_down.png`) | used by dev screens | still bundled (router internals) | none (≈ 15 KB) |
| `@expo/log-box` | dev LogBox | native module present, JS gated | none |
| Dev menu / dev client | `expo` dev launcher only in development builds; `expo-dev-client` is not installed | absent | none |
| Test utilities, mocks, `__tests__` | Jest only | unreachable from entry | none |
| Source maps | on demand | not emitted | none |
| `.expo/` folder, `.worktrees/` | local | ignored | none |

## 4. Release build inputs that must exist before Phase 5

1. `android.package` (reverse-DNS, immutable once published) and `ios.bundleIdentifier` — D-1.
2. Signing: EAS-managed keystore (default when using `eas build`) or a local keystore for `./gradlew bundleRelease` (the template generates a debug keystore only; a release keystore is needed for a Play upload but not for size measurement — a debug-signed release AAB has the same size).
3. `expo-build-properties` installed at the SDK 57 line (`npx expo install expo-build-properties`).
4. `ANDROID_HOME` set to `%LOCALAPPDATA%\Android\Sdk` for local Gradle builds.
