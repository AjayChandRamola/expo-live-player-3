# JavaScript Bundle Optimisation — Findings and Recommendations

Baseline: Android HBC 4,941,796 B; unminified JS 3,698,125 B attributed in `size-baseline.md` §3.1. All recommendations below are implementation-ready and cross-referenced to the LLD change catalogue.

## 1. What Metro already does (verified, no action)

| Topic | Finding | Evidence |
|---|---|---|
| Dead code / tree shaking | Metro includes only modules reachable from `expo-router/entry`. Unreferenced first-party files (`ShortsIcon.tsx`, `GlobalErrorLogger.ts`, `themed-*.tsx`, `use-theme-color.ts`) and unreferenced packages (`react-native-paper`, `react-native-calendars`, google fonts) contribute **0 bytes** today. Within a reachable module there is no export-level tree shaking | Source-map attribution lists none of those files or packages |
| Tree-shaking flags | `@expo/metro-config` 57.0.12 exposes no `EXPO_UNSTABLE_*` environment switches (grep of `build/`). Do not attempt undocumented tree-shaking | grep |
| Minification and bytecode | Production export uses Hermes bytecode (4.94 MB) built from minified JS. `--no-bytecode` output is unminified only because source maps were requested for attribution | export logs |
| Unused import elision | Babel's TypeScript transform drops unused value imports (`import * as Speech from "expo-speech"` in `useVoiceSearch.ts` is elided; `expo-speech` is absent from the bundle) | grep of bundle |
| CommonJS/ESM | RN ecosystem packages ship CommonJS-compatible builds; Metro handles both. No duplicated React or RN copies in the graph | lockfile analysis |
| Polyfills | `@react-native/js-polyfills`, `whatwg-fetch`, `whatwg-url-minimum`, `regenerator-runtime`, `event-target-shim`, `promise` total ≈ 47 KB unminified and are RN/Expo runtime requirements | attribution |
| Locale / date / utility libraries | None present (no moment, dayjs, lodash, i18n bundles) | attribution |
| Source maps | Not emitted by default production builds; only produced when `--source-maps` is passed | Expo CLI behaviour, verified by the HBC export having no map |
| Route-level code splitting | Not available for native bundles in Expo SDK 57 (a single HBC is embedded). `expo-router` lazy-evaluates route modules at runtime but they are all in the one bundle. No action | Expo docs; single `entry-*.hbc` |
| React Compiler | Enabled (`experiments.reactCompiler: true`); its runtime is negligible in attribution | `app.json`, attribution |

## 2. Findings that lead to changes

### 2.1 Icon barrel import bundles 15 font families (C-08)

- 18 files use `import { MaterialCommunityIcons } from "@expo/vector-icons"`. The package `main` (`build/IconsLazy.js`) requires every family at top level, and each family module imports its TTF. Result: 19 TTFs, 4,076,840 B, of which 2,412,340 B are never used.
- Fix: `import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"` in all 18 files. `components/ui/icon-symbol.tsx` already shows the pattern with `MaterialIcons`.
- Guard: ESLint `no-restricted-imports` for the barrel path so it cannot come back.
- Verification: `npx expo export --platform android` log lists exactly two `@expo/vector-icons` TTFs; `metadata.json` asset count drops from 47 to 30.
- Also removes 22,448 B of `@expo/vector-icons` JS down to the two family modules plus `createIconSet` (exact figure to be measured).

### 2.2 `react-native-svg` for two static icons (C-09)

- 104,413 B unminified JS plus a native library, for `assets/icons/shorts-*.svg` used only in the tab bar, plus a dead `components/ui/ShortsIcon.tsx`.
- Fix: rasterise both SVGs to PNG at 28, 56, 84 px (`tokens.iconSize.lg` is 28), render with `react-native` `Image`, delete the SVGs, `ShortsIcon.tsx`, `declarations.d.ts`, `__mocks__/svgMock.js`, the `moduleNameMapper` entries in `package.json` and `jest.web.config.js`, and the transformer block in `metro.config.js`; uninstall `react-native-svg` and `react-native-svg-transformer`.
- Verification: attribution shows no `react-native-svg`; `react-native-config` autolinking no longer lists it; tab icon visually identical at 1×/2×/3× (D-4).

### 2.3 Console logging reaches production (C-11)

- 73 `console.*` call sites in `app/(tabs)/shorts.tsx` (21), `CommentComposer.tsx` (23), `CommentsModal.tsx` (19), `GlobalErrorLogger.ts` (2, dead), `devLog.ts` (2, already `__DEV__`-gated), `useCommentsFeed.ts` (2), `useShortsPlayer.ts` (4). `utils/Logger.ts` forwards `debug/info/warn/error` to `console` unconditionally; `services/analytics.ts` is already `__DEV__`-gated.
- Fix: add `babel-plugin-transform-remove-console` to `babel.config.js` under `env.production` with `{ exclude: ["error", "warn"] }`. `Logger.error` and `Logger.warn` (the production observability path, including `installGlobalErrorHandlers`) are preserved; `console.log/info/debug` and their string arguments are removed from the production bundle.
- Why not edit each call site: the Shorts files are protected (R7) and the Comments module has 16 pre-existing type errors; a build-time transform is smaller, reversible, and covers future code.
- Verification: `grep -c "console.log" <unminified production export>` drops to 0; `Logger.error` string literals still present.

### 2.4 Dead first-party modules (C-07)

Zero bundle effect, but they carry 5 of the 29 runtime `tsc` errors and a reference to an uninstalled package: `hooks/useVoiceSearch.ts` (`expo-speech` import line only — the hook is used), `components/ui/ShortsIcon.tsx`, `components/GlobalErrorLogger.ts` (imports a non-existent `logToServer`), `components/themed-text.tsx`, `components/themed-view.tsx`, `hooks/use-theme-color.ts`. `constants/theme.ts` stays (used by `tokens.ts` and `ShortVideoPlayer.tsx`).

## 3. First-party bundle composition (for future budgeting)

| Area | Unminified bytes | Note |
|---|---|---|
| `components/VideoPlayer` | 79,119 | Protected module; not a target |
| `components/Video` (actions, container, meta) | 40,828 | — |
| `components/Comments` | 39,192 | Both `CommentsModal` and `HomeVideoCommentsModal` are reachable via the `components/Comments/index.ts` barrel (`export * from "./Home"`) from `ShortCard.tsx`. If only one is used at runtime, the barrel keeps both in the bundle. Candidate for a later, separate review; no change in this initiative because it lies behind Shorts (R7) |
| `components/VideoFeed` | 20,876 | — |
| `app/(tabs)` | 18,914 | `shorts.tsx` is the largest screen |
| `components/Shorts` | 16,117 | Protected (R7) |
| Everything else | ≈ 107,000 | — |

## 4. Findings that do not lead to changes now

### 4.1 `@expo/ui` and the Material Symbols font on Android

`expo-router/build/layouts/Stack.js` line 11 requires `./stack-utils/toolbar/StackToolbar` at module load; on Android the toolbar files require `@expo/ui/jetpack-compose`, which (a) adds 66,571 B of JS, (b) registers `@expo-google-fonts/material-symbols/400Regular` (966,544 B) as an asset through `expo-symbols`' Android weights, and (c) executes `requireNativeModule('ExpoUI')` at import. The app never renders a Stack toolbar, native tabs, or any `@expo/ui` component.

Options considered:

| Option | Effect | Why not now |
|---|---|---|
| `expo.autolinking.exclude: ["@expo/ui"]` in `package.json` | Removes Compose native code | `requireNativeModule('ExpoUI')` throws at startup because the JS import chain still runs. Unsafe |
| Metro `resolveRequest` that maps `@expo/ui/jetpack-compose` to a local stub on Android (experiment X-1) | Removes JS, font asset, and (with the exclude) native Compose | Patches router internals by resolver; breaks if any future route uses toolbar items; must be re-validated on every expo-router upgrade. Kept as a documented, off-by-default experiment with a measurement protocol; not part of the plan |
| Wait for expo-router to lazy-load the toolbar | Zero maintenance | Outside our control; track in the decision log and re-check on each SDK upgrade |

### 4.2 Reanimated (773 KB) and expo-router (454 KB)

Required by ADR 0003 (Reanimated-only animation) and by the product's navigation. No supported way to partially include them. Not a target.

## 5. Measurement tooling to add (C-02)

`scripts/measure-player-bundle.js` hard-codes `.baseline-export/_expo/static/js/android` and reports only player attribution. Add `scripts/measure-app-size.js` that:

1. Accepts an export directory argument (`node scripts/measure-app-size.js <dir>`).
2. Reports bundle bytes (`.hbc` or `.js`), asset count and bytes from `metadata.json`, the list of bundled TTFs with sizes, top 40 packages by mapped bytes when a `.js.map` is present, and first-party bytes.
3. Optionally asserts against `docs/size-optimization/size-budget.json` (`--assert`) and exits non-zero when a budget is exceeded (used in Phase 10).

`.baseline-export/` and `.size-reports/` are added to `.gitignore` (`.baseline-export` is currently not ignored, although `eslint.config.js` already ignores it).
