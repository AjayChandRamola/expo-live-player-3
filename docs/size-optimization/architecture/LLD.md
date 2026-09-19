# App Size Optimisation — Low-Level Design (Change Catalogue)

Every change has an identifier `C-nn`, and every other document refers to changes by that identifier. Each entry states: files, current state (verified 2026-09-19), desired state, reason, dependency impact, steps, tests, backward compatibility, and rollback. Commands are exact. Where an exact value depends on information that does not exist yet (identifiers, installed plugin schema), the entry says so and names the decision `D-nn` that provides it.

Common verification block, referred to as **GATES** below:

```
npx tsc --noEmit 2>&1 | grep -E "^(app|components|constants|contexts|hooks|services|types|utils)/" | grep -c "error TS"   # must be ≤ previous (baseline 29)
npm run lint 2>&1 | grep -E "✖"                                                                                              # errors must be ≤ previous (baseline 78)
npm test                                                                                                                       # 95/95 suites after C-01
npx expo export --platform android --output-dir .baseline-export/android
npx expo export --platform ios --output-dir .baseline-export/ios
node scripts/measure-app-size.js .baseline-export/android
node scripts/measure-app-size.js .baseline-export/ios
```

---

## Phase 0 — Baseline and safety net

### C-01 Restore the Jest safety net (Reanimated 4 mock)

- **Files:** `__tests__/harness/setup.ts` (edit). No production file.
- **Current state:** line 39–58 mocks `react-native-reanimated` by `jest.requireActual("react-native-reanimated/mock")` and wraps `useSharedValue` in a ref. Under Reanimated 4.5.1 the mock's `./index` import reaches `react-native-worklets`, which expects its native proxy and throws `Cannot read properties of undefined (reading 'loadUnpackers')`. 15 suites fail to run.
- **Desired state:** all 95 suites run; 652+ tests pass; the `useSharedValue` ref wrapper is retained.
- **Reason:** The failing suites are the player UI/root and action-bar suites — the regression net for C-08.
- **Steps:**
  1. Reproduce: `npx jest __tests__/player/ui/SkipButton.test.tsx` shows the `loadUnpackers` error.
  2. Add, **above** the existing `jest.mock("react-native-reanimated", ...)` block:
     ```ts
     // Reanimated 4 delegates worklet runtime calls to react-native-worklets, which
     // has no native proxy under Jest. Its shipped mock provides the JS-only API.
     jest.mock("react-native-worklets", () =>
       jest.requireActual("react-native-worklets/lib/module/mock"),
     );
     ```
     The package has no `exports` map (verified), so the deep path resolves. If `lib/module/mock.js` fails to load under the CommonJS Jest transform, use `react-native-worklets/lib/commonjs/mock` (check `ls node_modules/react-native-worklets/lib/commonjs/mock.js`).
  3. Re-run the single suite, then `npm test`. Expect `Test Suites: 95 passed, 95 total`.
  4. If a suite still fails, apply `superpowers:systematic-debugging`; do not weaken assertions.
- **Edge cases:** the web Jest project (`jest.web.config.js`, `__tests__/harness/setup.web.ts`) may need the same mock; run `npm run test:web` and add it there only if it fails for the same reason.
- **Tests:** the suites themselves. Also add `__tests__/harness/reanimated-mock.test.ts` asserting that `require("react-native-reanimated").useSharedValue(1).value === 1` and identity survives re-render (guards the wrapper).
- **Backward compatibility:** test-only.
- **Rollback:** `git revert` the commit.

### C-02 Measurement tooling and ignore rules

- **Files:** `scripts/measure-app-size.js` (new), `docs/size-optimization/size-budget.json` (new), `package.json` scripts (edit), `.gitignore` (edit), `__tests__/scripts/measureAppSize.test.ts` (new) with fixture under `__tests__/fixtures/export-sample/`.
- **Current state:** `scripts/measure-player-bundle.js` hard-codes `.baseline-export/_expo/static/js/android` and reports player attribution only. `.baseline-export/` is not git-ignored (only ESLint ignores it).
- **Desired state:**
  - `node scripts/measure-app-size.js <exportDir> [--json] [--assert <budget.json>]` prints:
    - `bundleBytes` (largest `.hbc` or `.js` under `_expo/static/js/<platform>/`), `platform` (from `metadata.json` `fileMetadata` key),
    - `assetCount`, `assetBytes` (from `metadata.json` assets; each `path` stat'ed),
    - `ttf` list `[ {bytes, hash} ]` sorted descending,
    - when a `.js.map` exists: `mappedBytes`, `unmappedBytes`, `firstPartyBytes`, `topPackages` (top 40, same VLQ method as the existing script),
    - `autolinking`: `{ android: n, ios: n }` by spawning `npx expo-modules-autolinking resolve -p <p> --json` (skip with `--no-autolinking`).
    - With `--assert`, compares `bundleBytes`, `assetBytes`, `assetCount`, `ttfCount` against the budget file for the platform and exits 1 on any excess, printing both numbers.
  - `size-budget.json` initial content equals the Phase 0 measured values (so the first assertion passes) and is tightened after each accepted change:
    ```json
    { "android": { "bundleBytes": 4941796, "assetBytes": 5071209, "assetCount": 47, "ttfCount": 20 },
      "ios":     { "bundleBytes": 4750938, "assetBytes": 4105051, "assetCount": 43, "ttfCount": 19 } }
    ```
  - `package.json` scripts added: `"typecheck": "tsc --noEmit"`, `"size:export": "expo export --platform android --output-dir .baseline-export/android && expo export --platform ios --output-dir .baseline-export/ios"`, `"size:report": "node scripts/measure-app-size.js .baseline-export/android && node scripts/measure-app-size.js .baseline-export/ios"`, `"size:check": "node scripts/measure-app-size.js .baseline-export/android --assert docs/size-optimization/size-budget.json && node scripts/measure-app-size.js .baseline-export/ios --assert docs/size-optimization/size-budget.json"`.
  - `.gitignore` additions: `.baseline-export/`, `.size-reports/`, `*.apks`, `*.aab`, `*.apk`, `*.ipa`.
- **Reason:** RC-8; every later change needs a repeatable before/after.
- **Steps:** write the fixture (a tiny `metadata.json`, one 10-byte `.hbc`, two fake `.ttf` assets), write the failing test, implement, run, then run against the real exports and confirm the numbers match `size-baseline.md` §3.
- **Tests:** unit test on the fixture: counts, bytes, ttf list, `--assert` pass and fail paths (exit code and message).
- **Backward compatibility:** `measure-player-bundle.js` is left unchanged (still used by `docs/player/baselines`).
- **Rollback:** delete the new files, revert `package.json` and `.gitignore`.

### C-03 Application identifiers and EAS profiles

- **Files:** `app.json` (edit), `eas.json` (new).
- **Current state:** no `android.package`, no `ios.bundleIdentifier`, no `eas.json`.
- **Desired state:** `expo.android.package = "<D-1 value>"`, `expo.ios.bundleIdentifier = "<D-1 value>"`; `eas.json`:
  ```json
  { "cli": { "version": ">= 16.0.0", "appVersionSource": "local" },
    "build": {
      "development": { "developmentClient": false, "distribution": "internal" },
      "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
      "production": { "distribution": "store", "android": { "buildType": "app-bundle" }, "autoIncrement": false } },
    "submit": { "production": {} } }
  ```
  Verify the `cli.version` constraint against the installed `eas --version` before committing.
- **Reason:** prebuild and any native build need the identifiers; the AAB baseline needs a profile.
- **Blocked by:** D-1 (identifier values), D-2 (local Gradle versus EAS). Identifiers are permanent once published; the human must choose them.
- **Tests:** `npx expo config --type introspect` prints the identifiers; `npx expo-doctor` clean.
- **Rollback:** revert the commit (safe only before the first store upload).

### C-03b Android release baseline build (measurement only, no repository change)

- **Commands:** `android-optimization.md` §4. Outputs to `.size-reports/` (ignored). Record AAB bytes, per-ABI download sizes, universal APK bytes, `lib/` bytes per ABI, `classes*.dex` bytes, `assets/` bytes, and `aapt2 dump badging` permissions into `size-baseline.md` §6 and `size-budget.json` (add `"aabBytes"` and `"arm64DownloadBytes"` keys).
- **Note:** `expo prebuild` writes `android/` (git-ignored). Do not commit it. Set `ANDROID_HOME` for the session only.

---

## Phase 1 — Dependency cleanup

### C-04 Remove unused native packages

- **Files:** `package.json`, `package-lock.json`.
- **Packages:** `expo-audio`, `expo-linear-gradient`, `expo-web-browser`, `@react-native-community/slider`.
- **Current state:** installed, autolinked (Android and iOS), zero import sites, no dependents (`npm ls`).
- **Desired state:** absent from `package.json`, lockfile, and both autolinking outputs.
- **Steps:**
  1. `grep -rE "expo-audio|expo-linear-gradient|expo-web-browser|@react-native-community/slider" app components constants contexts hooks services types utils __tests__ __mocks__ scripts` → no output (verified today; re-run).
  2. `npm uninstall expo-audio expo-linear-gradient expo-web-browser @react-native-community/slider`
  3. `npx expo-modules-autolinking resolve -p android --json | node -e "..."` → 20 modules; `-p ios` → 22; `react-native-config -p android` → no slider.
  4. GATES. `npx expo-doctor`.
- **Dependency impact:** none downstream. `ios.infoPlist.UIBackgroundModes: ["audio"]` stays (used by expo-video for background audio capability; engine sets `staysActiveInBackground=false`, harmless).
- **Tests:** existing suites; add an assertion in `__tests__/scripts/dependencyGuards.test.ts` (new) that `package.json` dependencies do not include any name from a `FORBIDDEN_DEPENDENCIES` list (the four here plus C-05's).
- **Rollback:** `git revert` then `npm ci`.

### C-05 Remove unused JavaScript-only packages

- **Packages:** `react-native-paper`, `react-native-calendars`, `react-native-collapsible`, `ajv`, `@expo-google-fonts/mukta`, `@expo-google-fonts/noto-sans-devanagari`, `@expo-google-fonts/roboto`.
- **Current state:** installed, zero imports, zero bundle bytes, 26 MB on disk combined.
- **Steps:** grep as in C-04 (add `useFonts` and `Mukta_|NotoSansDevanagari_|Roboto_` patterns), `npm uninstall <all seven>`, GATES.
- **Reason:** YAGNI; R5 forbids paper in the player; feature catalog O3.
- **Tests:** `dependencyGuards.test.ts` list extended.
- **Rollback:** `git revert` + `npm ci`.

### C-06 Move or remove development tooling listed under `dependencies`

- **Current state:** `@babel/core`, `@types/react`, `@types/react-dom`, `typescript` appear in both sections with conflicting ranges; `prettier`, `eslint-config-prettier`, `eslint-plugin-react`, `eslint-plugin-react-hooks` are in `dependencies`; `npm-force-resolutions` is in `devDependencies` with no `resolutions` field.
- **Desired state:** each tool appears once, under `devDependencies`; `npm-force-resolutions` removed; `typescript` at one version chosen by D-9 (recommendation: keep `~6.0.3` since `tsc` runs with it today and `CLAUDE.md` is updated to say so; alternative `~5.9.2` per `CLAUDE.md`).
- **Steps:**
  1. `grep -rn "prettier" .vscode/settings.json eslint.config.js package.json` — if `.vscode/settings.json` uses the Prettier extension with the local package, keep `prettier` in devDependencies; otherwise remove it. Remove `eslint-config-prettier`, `eslint-plugin-react`, `eslint-plugin-react-hooks` unless `eslint.config.js` references them (it does not today).
  2. Edit `package.json` by hand (remove from `dependencies`; ensure present once in `devDependencies`), then `npm install` to rewrite the lockfile, then `npm ls typescript @types/react @babel/core` shows one version each.
  3. GATES; `npm run lint` must produce the same result as before.
- **Reason:** hygiene, install time, no ambiguity about which TypeScript is used; zero production bytes.
- **Rollback:** `git revert` + `npm ci`.

### C-07 Dead first-party modules and the `expo-speech` import

- **Files:** delete `components/ui/ShortsIcon.tsx`, `components/GlobalErrorLogger.ts`, `components/themed-text.tsx`, `components/themed-view.tsx`, `hooks/use-theme-color.ts`; delete `assets/images/react-logo.png`, `react-logo@2x.png`, `react-logo@3x.png` (D-7); edit `hooks/useVoiceSearch.ts` to remove line 16 `import * as Speech from "expo-speech";` only.
- **Current state:** none of the five modules is imported anywhere (grep verified); `GlobalErrorLogger.ts` imports a non-existent `logToServer`; `use-theme-color.ts` has 2 type errors; `useVoiceSearch.ts` imports an uninstalled package it never uses (Babel elides it; `tsc` errors).
- **Desired state:** files removed; runtime `tsc` error count drops by 5 (29 → 24); no behaviour change.
- **Caution:** `hooks/useVoiceSearch.ts` is outside `components/Shorts/` and `hooks/useShortsPlayer.ts`, so R7 is unaffected. `constants/theme.ts` stays.
- **Tests:** GATES; `__tests__/navigation/tabLayout.test.tsx` unaffected (uses `icon-symbol`).
- **Rollback:** `git revert`.

---

## Phase 2 — Asset optimisation

### C-08 Deep icon imports and lint guard

- **Files (18):** `app/(tabs)/shorts.tsx`†, `components/Comments/CommentComposer.tsx`, `components/Comments/CommentItem.tsx`, `components/Comments/CommentsModal.tsx`, `components/Comments/Home/HomeVideoCommentsModal.tsx`, `components/Search/SearchInput.tsx`, `components/Shorts/ShortActions.tsx`†, `components/Shorts/ShortCard.tsx`†, `components/Shorts/ShortsSearchBar.tsx`†, `components/Shorts/ShortVideoPlayer.tsx`†, `components/ui/IconButton.tsx`, `components/Video/actions/sheets/ClipEditor.tsx`, `components/Video/actions/sheets/OverflowMenu.tsx`, `components/Video/actions/sheets/SaveSheet.tsx`, `components/Video/actions/VideoActionButton.tsx`, `components/VideoPlayer/ui/controls/ControlButton.tsx`‡, `components/VideoPlayer/ui/ErrorCard.tsx`‡, `components/VideoPlayer/ui/SwipeIndicator.tsx`‡; plus `eslint.config.js`.
  † under `components/Shorts/` or the Shorts screen — 4 of the 5 need D-3 (`app/(tabs)/shorts.tsx` is not covered by R7's path list but is Shorts by product rule). ‡ protected player module — import-line-only change under the video-player.md workflow.
- **Current state:** `import { MaterialCommunityIcons } from "@expo/vector-icons";`
- **Desired state:** `import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";` — the default export of `build/MaterialCommunityIcons.js` is the identical component object that the barrel re-exports, so JSX usage is unchanged. `eslint.config.js` gains:
  ```js
  {
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "@expo/vector-icons",
                  message: "Import the family directly, e.g. @expo/vector-icons/MaterialCommunityIcons, to avoid bundling all 15 icon fonts." }],
      }],
    },
  }
  ```
- **Reason:** RC-1; −2,412,340 B assets per platform.
- **Order:** do the 14 non-Shorts files first (commit), then the 4 Shorts files (separate commit, only after D-3). Until the Shorts commit lands, the barrel is still imported by Shorts and the font count does not drop — the intermediate export will show 20 TTFs; that is expected and the assertion budget is tightened only after the second commit.
- **R7 handling:** on `main`, `git diff --stat main -- components/Shorts` is empty once committed, so the invariants suite passes after commit. Run `npm test` after committing, not before, for the Shorts commit (or temporarily verify with the other suites and run invariants after commit).
- **Tests:** existing suites (none mock `@expo/vector-icons`; they render the real component under jest-expo). New lint fixture test: `__tests__/lint/noBarrelIcons.test.ts` runs ESLint's Node API on a string containing the barrel import and expects one `no-restricted-imports` error. Export check: `size:report` shows `ttf` count 3 on Android (MCI, MaterialIcons, Material Symbols) and 2 on iOS.
- **Backward compatibility:** none affected; web export uses the same modules.
- **Rollback:** `git revert` per commit.

### C-08b (optional) Retire `MaterialIcons` by mapping tab icons to MCI

- **File:** `components/ui/icon-symbol.tsx`.
- **Current:** `MAPPING` uses MaterialIcons names `home`, `send`, `code`, `chevron-right`, `live-tv`, `bookmark`, `search`, `settings`; three (`send`, `code`, `chevron-right`) are unused.
- **Desired:** import `MaterialCommunityIcons` deep and map `house.fill → "home"`, `dot.radiowaves.left.and.right → "access-point"` (or `"broadcast"`), `bookmark.fill → "bookmark"`, `magnifyingglass → "magnify"`, `gearshape.fill → "cog"`; drop unused entries. Also fixes the two `tsc` errors in this file by typing `MAPPING` as `Record<IconSymbolName, ComponentProps<typeof MaterialCommunityIcons>["name"]>` with an explicit union for `IconSymbolName`.
- **Effect:** −356,840 B; Android/web tab glyphs change shape slightly. Requires D-4b. iOS unaffected (SF Symbols).
- **Tests:** `__tests__/navigation/tabLayout.test.tsx` asserts icon names; update expectations.
- **Rollback:** revert.

### C-09 Rasterise the Shorts tab icon and remove `react-native-svg`

- **Files:** add `assets/icons/shorts-active.png`, `shorts-active@2x.png`, `shorts-active@3x.png`, and the `shorts-inactive` trio (28/56/84 px, RGBA, generated from the SVGs with an exact-colour rasteriser such as `resvg` or `sharp`; commit the generation command in `scripts/README` or the plan); edit `app/(tabs)/_layout.tsx`; delete `assets/icons/*.svg`, `components/ui/ShortsIcon.tsx` (if not already by C-07), `declarations.d.ts`, `__mocks__/svgMock.js`; edit `metro.config.js` (restore default), `package.json` (`jest.moduleNameMapper` entry, uninstall `react-native-svg`, `react-native-svg-transformer`), `jest.web.config.js` (`moduleNameMapper`), `tsconfig.json` (no change needed; `declarations.d.ts` is picked up by the `**/*.ts` include and simply disappears).
- **Current `_layout.tsx`:** `import ShortsActive from "@/assets/icons/shorts-active.svg"` and `<ShortsActive width={tokens.iconSize.lg} height={tokens.iconSize.lg} />`.
- **Desired `_layout.tsx`:**
  ```tsx
  import { Image } from "react-native";
  const SHORTS_ACTIVE = require("@/assets/icons/shorts-active.png");
  const SHORTS_INACTIVE = require("@/assets/icons/shorts-inactive.png");
  // ...
  tabBarIcon: ({ focused }) => (
    <Image
      source={focused ? SHORTS_ACTIVE : SHORTS_INACTIVE}
      style={{ width: tokens.iconSize.lg, height: tokens.iconSize.lg }}
      accessibilityIgnoresInvertColors
    />
  ),
  ```
  Metro selects `@2x`/`@3x` by device scale automatically. No `tintColor` (the icons have fixed brand colours today).
- **Desired `metro.config.js`:** `module.exports = getDefaultConfig(__dirname);` with the comment explaining that SVG support was removed on 2026-09 (link to this document).
- **Reason:** RC-4; −104,413 B unminified JS; one fewer native module on Android and iOS.
- **Blocked by:** D-4 (visual sign-off on emulator at 1×, 2×, 3× against the current SVG rendering; provide side-by-side screenshots).
- **Tests:** update `__tests__/navigation/tabLayout.test.tsx` to assert an `Image` with the PNG source for the Shorts tab in both focused states; remove the svg mock; GATES; `react-native-config` autolinking no longer lists `react-native-svg`; attribution no longer lists it.
- **Edge cases:** web export — RN Web renders `Image` with the same PNG; verify `npx expo export --platform web` still succeeds (it is part of `test:web` scope, not of the size targets).
- **Rollback:** `git revert` + `npm ci` (restores SVGs, transformer, mocks).

### C-10 (optional) Replace the React-logo placeholder with a blurhash

- **Files:** `components/VideoFeed/VideoCard.tsx:147`, `components/VideoFeed/UpNextList.tsx:83`, `constants/tokens.ts` (add `placeholderBlurhash`), delete `assets/images/partial-react-logo.png`.
- **Desired:** `placeholder={{ blurhash: tokens.placeholderBlurhash }}` where the constant is a short neutral hash (for example `"L6PZfSi_.AyE_3t7t7R**0o#DgR4"` is a common neutral grey-blue; choose one matching the brand palette and record it). expo-image supports `placeholder={{ blurhash }}` (verify in `node_modules/expo-image/build/Image.types.d.ts` `ImageSource.blurhash`).
- **Effect:** −5,075 B; removes React branding from the feed. Requires D-5.
- **Tests:** `__tests__/screens/HomeScreen.test.tsx` and any snapshot referencing the PNG; GATES.
- **Rollback:** revert.

---

## Phase 3 — JavaScript optimisation

### C-11 Strip `console.log/info/debug` in production

- **Files:** `babel.config.js`, `package.json` (devDependency `babel-plugin-transform-remove-console`), `__tests__/build/babelProduction.test.ts` (new).
- **Current:** no `env` block.
- **Desired:**
  ```js
  module.exports = function (api) {
    api.cache(true);
    return {
      presets: ["babel-preset-expo"],
      plugins: [
        ["module-resolver", { root: ["./"], alias: { "@": "./" } }],
        "react-native-reanimated/plugin",
      ],
      env: {
        production: {
          plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
        },
      },
    };
  };
  ```
  `api.cache(true)` must become `api.cache.using(() => process.env.NODE_ENV)` so the production branch is not cached from a development run (Babel evaluates `env` by `BABEL_ENV || NODE_ENV`; `expo export` sets `NODE_ENV=production`).
- **Reason:** RC-5; removes 73 call sites' code and strings from production; keeps `console.error`/`console.warn`, which `utils/Logger.ts` `error`/`warn` use.
- **Tests:** transform test: run `@babel/core` `transformSync` on a fixture string with `console.log("x"); console.error("y");` using the project config with `envName: "production"` and assert the output contains `console.error` and not `console.log`; and with `envName: "development"` both remain. Export check: `grep -c "\[ShortsSearch\]" .baseline-export/android-js/...js` is 0 in a production `--no-bytecode` export (that string comes from a `Logger.info` site in `ShortsSearchBar.tsx` — note `Logger.info` calls `cInfo` which is `console.info` bound at module load; the plugin removes direct `console.info(...)` calls, and `safeConsole("info")` returns a bound function whose call is not a `console.*` member call. Therefore `Logger.info/debug` bodies remain unless `utils/Logger.ts` is also changed).
- **Companion edit (same change):** in `utils/Logger.ts`, gate `debug` and `info` with `if (!__DEV__) return;` at the top of each function. This keeps `warn` and `error` in production and makes the Babel plugin and the logger consistent. `__tests__/Logger.test.ts` must be updated to set `global.__DEV__` explicitly for the info/debug expectations.
- **Backward compatibility:** development behaviour unchanged.
- **Rollback:** revert.

---

## Phase 4 — Expo configuration

### C-12 Confirm defaults; no functional change

- Verify and record in `build-architecture.md`: `jsEngine` (Hermes), New Architecture, `experiments` unchanged, `assetBundlePatterns` absent (SDK 57 has no such key), `web.output: static` unchanged.
- Do **not** add `expo.autolinking.exclude` (see DL-08).

---

## Phase 5 — Android native

### C-14 R8 and resource shrinking via `expo-build-properties`

- **Files:** `package.json` (`npx expo install expo-build-properties`), `app.json` plugins.
- **Desired `app.json` plugin entry:**
  ```json
  ["expo-build-properties", { "android": { "enableProguardInReleaseBuilds": true, "enableShrinkResourcesInReleaseBuilds": true } }]
  ```
  After install, open `node_modules/expo-build-properties/build/pluginConfig.d.ts` and confirm these two keys exist for SDK 57. If the schema also offers `enableMinifyInReleaseBuilds`, set it to `true` as well. Do not set `useLegacyPackaging`, `enableBundleCompression`, or ABI filters in this change.
- **Verification:** `npx expo prebuild -p android --clean`; `grep -n "enableProguardInReleaseBuilds\|enableShrinkResourcesInReleaseBuilds\|minifyEnabled\|shrinkResources" android/gradle.properties android/app/build.gradle` shows `true`; build the AAB (C-03b commands); retain `android/app/build/outputs/mapping/release/mapping.txt` in `.size-reports/`.
- **Regression (mandatory before accepting):** install the release APK (from `bundletool --mode=universal` or the `preview` profile) on an emulator and run the full `implementation/regression-matrix.md` rows marked "release" — in particular MP4, HLS, live fallback (WebView), seek, fullscreen/rotate, background/foreground, save/like persistence, deep link, share sheet, download flag off path.
- **If a failure is reproduced:** add the narrowest keep rule via `extraProguardRules` (for example `-keep class androidx.media3.** { *; }` only if HLS fails), rebuild, re-measure. Record the rule and the reason in the decision log.
- **Effect:** NOT MEASURED until done; report the four Android numbers before and after.
- **Rollback:** remove the plugin entry (and the package); the next prebuild regenerates defaults.

### C-15 iOS build properties (no change by default)

- Do not add iOS build properties. Experiment X-3 (`expo-image.disable-libdav1d` in `ios/Podfile.properties.json`, set through `expo-build-properties` `ios.extraPods`? — no: it is a Podfile property; with the managed workflow it is set via the `expo-build-properties` plugin only if that plugin exposes it; otherwise it requires a custom config plugin that writes `Podfile.properties.json`) is documented in the SPEC and executed only after D-6.

---

## Phase 6 — Video architecture

### C-16 No code change; verification only

- Run the player invariants suite and the playback rows of the regression matrix on the emulator release build. Confirm `PlaybackEngine` still sets `keepScreenOnWhilePlaying` and `staysActiveInBackground` (grep) — they are untouched by this initiative but form the F22 evidence.

---

## Phase 7 — Production build

### C-17 Release pipeline documentation and mapping retention

- **Files:** `docs/size-optimization/architecture/build-architecture.md` §4 (update with the chosen D-2 path), `README.md` (add "Building a release" section pointing to it).
- Ensure source maps are not emitted in release; ensure `mapping.txt` retention is written into the EAS or Gradle notes.

---

## Phase 8/9 — Regression and verification

### C-18 Execute the matrices

- `implementation/regression-matrix.md` (functional) and `optimization/performance-impact.md` §3 (performance, emulator parts) on the final release build; fill `size-baseline.md` §6 "after" columns; update `size-budget.json` to the achieved values.

---

## Phase 10 — Hardening

### C-19 Guards and documentation

- **Files:** `eslint.config.js` (extend `no-restricted-imports` with the removed package names so a re-introduction fails lint before install), `__tests__/scripts/dependencyGuards.test.ts` (final list), `docs/reference/Project-structure-of-expo-live-player.md` (remove deleted files; add `scripts/measure-app-size.js`), `CLAUDE.md` §1 stack line (SDK 57, TypeScript version per D-9 — **only after the human approves the wording**), `docs/size-optimization/optimization/size-baseline.md` (final table), `docs/size-optimization/optimization/optimization-decision-log.md` (status updates).
- Add `npm run size:check` to the documented pre-merge checklist (no CI exists; if the human later adds CI, this is the command to run).

---

## Experiments (off by default; each needs a decision)

| ID | What | Accept rule | Reject rule | Decision |
|---|---|---|---|---|
| X-1 | Metro `resolveRequest` mapping `@expo/ui/jetpack-compose` → `scripts/stubs/expo-ui-jetpack-compose.js` on Android, plus `expo.autolinking.exclude: ["@expo/ui"]` | App launches on emulator; full matrix passes; Android assets drop by 966,544 B; AAB smaller | Any launch or navigation failure; or any use of Stack toolbar/native tabs planned | Deferred; not recommended now (DL-08) |
| X-3 | `expo-image.disable-libdav1d = true` (iOS) | Backend guarantees no AVIF (D-6); iOS IPA smaller (EAS measurement); thumbnails render | Any AVIF in content pipeline | Needs D-6 |
| X-4 | `MaterialIcons` retirement (C-08b) | Human accepts the Android tab glyphs | Otherwise | Needs D-4b |
