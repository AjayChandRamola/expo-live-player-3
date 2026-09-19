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
| Confirmed 2026-09-19 | `npx expo config --type introspect` shows `output: 'static'`, `typedRoutes: true`, `reactCompiler: true`; no `jsEngine` or `newArchEnabled` keys anywhere in `app.json` (SDK 57 defaults: Hermes, New Architecture both on); `grep -c '"autolinking"' package.json` → `0` (no autolinking excludes) | C-12: confirmed, no change needed |

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

### Path actually used (2026-09-19)

D-1 resolved to `com.yagna.app` for both `android.package` and `ios.bundleIdentifier` (no prior domain convention existed; change before any store submission if a different reverse-DNS domain is preferred). D-2 resolved to **local Gradle**, since Java 17.0.12 and the Android SDK (build-tools 36.1.0-rc1) were already present on the development machine, giving faster iteration than an EAS cloud build for the repeated Phase 0/Phase 5 measurement cycles.

Exact commands used for every native build in this initiative:

```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
npx expo prebuild -p android --clean --no-install
cd android && ./gradlew :app:bundleRelease --no-daemon
```

Both the Task 4 baseline build (39m 56s, 683 tasks) and the Task 16 R8-enabled build (57m 12s, 629 tasks) succeeded with `BUILD SUCCESSFUL` using this exact sequence, signed with the debug keystore (`bundletool build-apks` warns about this; it does not affect measured size). `expo prebuild` mutates the `android`/`ios` npm scripts as an unrelated side effect (`expo start --android` → `expo run:android`); these two lines were manually reverted after each prebuild since they are out of scope for the size initiative's commits.

Measurement tool: `bundletool` 1.18.3, downloaded from `https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar` and cached at `.size-reports/bundletool.jar` (git-ignored).
