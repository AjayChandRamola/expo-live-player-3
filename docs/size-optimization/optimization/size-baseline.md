# Size Baseline — 2026-09-19

All measurements were taken on the `main` branch at commit `b3fb438` with a clean working tree (only `.claude/` local files modified) on Windows 11, Node 26.8.2, npm 11.19.1. Commands are given so the implementer can reproduce every number. Where a metric could not be produced in this environment, it is marked **NOT MEASURED** with the exact method to use in Phase 0 or Phase 9.

## 1. Environment and versions (measured)

| Item | Value | Source |
|---|---|---|
| Expo SDK | 57.0.23 | `node_modules/expo/package.json` |
| React Native | 0.86.3 | `node_modules/react-native/package.json` |
| React | 19.2.3 | `node_modules/react/package.json` |
| expo-router | 57.0.21 | `node_modules/expo-router/package.json` |
| expo-video | 57.0.4 | `node_modules/expo-video/package.json` |
| react-native-reanimated / worklets | 4.5.1 / 0.10.1 | `node_modules` |
| TypeScript (installed) | 6.0.3 (the `devDependencies` entry wins over the `~5.9.2` entry in `dependencies`) | `node_modules/typescript/package.json` |
| Node / npm | 26.8.2 / 11.19.1 | `node -v`, `npm -v` |
| JS engine | Hermes (Expo default; `jsEngine` not set in `app.json`) | `app.json` |
| Renderer | New Architecture only (RN 0.86 has no legacy renderer) | RN version |
| Native projects | none (`android/`, `ios/` absent and git-ignored; managed workflow) | `ls`, `.gitignore` |
| EAS config | none (`eas.json` absent); `eas` CLI is installed globally | `ls`, `where eas` |
| Android toolchain on this machine | Android SDK at `%LOCALAPPDATA%\Android\Sdk` (build-tools, emulator present), Java 17.0.12; `ANDROID_HOME` unset | `ls`, `java -version` |
| `app.json` identifiers | `android.package` and `ios.bundleIdentifier` are **absent** (prebuild will prompt for them) | `app.json` |

## 2. Dependency counts (measured)

| Metric | Value | Command |
|---|---|---|
| `dependencies` entries | 50 | `package.json` |
| `devDependencies` entries | 16 | `package.json` |
| Packages in lockfile | 1,277 | `node -e` over `package-lock.json` `packages` |
| Packages present at more than one version | 99 (none are React, RN, Reanimated, Screens, Safe Area, SVG, or Expo Modules Core; duplicates are tooling: `ajv`, `glob`, `minimatch`, `semver`, `chalk`, `hermes-parser`, and similar) | same script |
| Expo modules autolinked for Android | 23 | `npx expo-modules-autolinking resolve -p android --json` |
| Expo modules autolinked for iOS | 25 | `npx expo-modules-autolinking resolve -p ios --json` |
| React Native community modules autolinked (Android) | 11: async-storage, slider, masked-view, expo, gesture-handler, reanimated, safe-area-context, screens, svg, webview, worklets | `npx expo-modules-autolinking react-native-config -p android --json` |
| Direct dependencies with zero import sites in `app/ components/ constants/ contexts/ hooks/ services/ types/ utils/` | 27 of 50 (see `dependency-audit.md` for each one and why it still exists) | grep over import specifiers |

## 3. JavaScript bundle (measured)

Commands (run from repository root; outputs went to the session scratchpad, not the repository):

```
npx expo export --platform android --output-dir <scratch>/export-android-hbc
npx expo export --platform android --no-bytecode --source-maps --output-dir <scratch>/export-android-js
npx expo export --platform ios --output-dir <scratch>/export-ios-hbc
```

| Metric | Android | iOS | Notes |
|---|---|---|---|
| Hermes bytecode bundle (`entry-*.hbc`) | 4,941,796 | 4,750,938 | This is what ships inside the app (`index.android.bundle` / `main.jsbundle`). |
| Unminified JS (`--no-bytecode`) | 3,698,125 | not exported | Used only for source-map attribution. |
| Source map | 12,017,836 | — | Never shipped. |
| Bundled assets (bytes) | 5,071,209 | 4,105,051 | Assets referenced by the module graph. |
| Bundled assets (files) | 47 | 43 | Android adds 4 XML/PNG variants. |
| Export total excluding source map | 10,016,162 | 8,858,882 | JS + assets + `metadata.json`. |

The previous baseline in `docs/player/baselines/2026-09-16-current-player.md` (SDK 54) recorded 3,760,191 B unminified JS and a 3.45 MB HBC. Today's figures are on SDK 57 and are not directly comparable, but the order of magnitude is unchanged.

### 3.1 Attribution of the unminified Android bundle by package (measured)

Method: decode the source-map VLQ mappings and charge the bytes between consecutive segments to the segment's source (the same method as `scripts/measure-player-bundle.js`, generalised to packages). 3,698,125 B total; 2,960,092 B mapped; 737,770 B unmapped (Metro prelude, module wrappers, polyfills without mappings); 322,493 B first-party.

| Bytes | Package | Why it is in the graph |
|---|---|---|
| 773,268 | react-native-reanimated | Player animation (ADR 0003), expo-router peer |
| 628,594 | react-native | Framework |
| 454,058 | expo-router | Navigation |
| 106,977 | react-native-gesture-handler | Player gestures, Shorts, expo-router peer |
| 104,413 | react-native-svg | Two tab-bar SVG icons (`assets/icons/shorts-*.svg`) |
| 98,671 | expo | Runtime |
| 92,637 | react-native-worklets | Reanimated 4 runtime |
| 66,571 | @expo/ui | Pulled by expo-router's Android Stack toolbar modules; the app does not use it |
| 62,672 | react-native-screens | expo-router |
| 22,448 | @expo/vector-icons | Icons |
| 18,288 | whatwg-url-minimum | expo runtime |
| 13,923 | expo-modules-core | Runtime |
| 12,569 | react-native-webview | `LiveEmbedView` YouTube fallback |
| 11,349 | expo-image | Thumbnails and poster |
| 10,027 | whatwg-fetch | RN polyfill |
| ≤ 9,882 each | color-convert, expo-file-system, react, normalize-colors, js-polyfills, expo-asset, regenerator-runtime, event-target-shim, expo-linking, expo-font, color, async-storage, query-string, expo-screen-orientation, safe-area-context, promise, scheduler, expo-video, metro-runtime, structured-clone, color-name, color-string, hoist-non-react-statics, expo-constants, @radix-ui/react-slot, expo-brightness, expo-haptics, metro, expo-symbols, stacktrace-parser | Runtime and small helpers |

First-party bytes by area: `components/VideoPlayer` 79,119; `components/Video` 40,828; `components/Comments` 39,192; `components/VideoFeed` 20,876; `app/(tabs)` 18,914; `components/Shorts` 16,117; `components/Live` 10,353; `services/videoService.ts` 8,703; everything else under 5,500 each.

### 3.2 Bundled assets by origin (measured)

| Bytes | Files | Origin | Needed? |
|---|---|---|---|
| 4,076,840 | 19 TTF | `@expo/vector-icons` — all 15 families (FontAwesome 5 and 6 contribute three files each) | Only `MaterialCommunityIcons.ttf` (1,307,660) and `MaterialIcons.ttf` (356,840) are used: 1,664,500 B needed, 2,412,340 B not needed |
| 966,544 | 1 TTF (Android only) | `@expo-google-fonts/material-symbols/400Regular` via `expo-symbols` (Android weights) via `@expo/ui` via expo-router's Android toolbar | Not used by the app; cannot be removed without changing expo-router internals (see `bundle-optimization.md` §4) |
| 9,456 + 4,752 + 465 + smaller | 13 PNG | expo-router internal assets (`arrow_down`, `unmatched`, `sitemap`, back/close/search icons) | Part of expo-router |
| 5,075 | 1 PNG | `assets/images/partial-react-logo.png` — thumbnail placeholder in `VideoCard.tsx` and `UpNextList.tsx` | Replaceable by a zero-byte blurhash placeholder |
| 619 | 2 XML | Android vector variants from expo-router | Part of expo-router |

Fonts are 99.4 % of bundled asset bytes. The two Shorts tab SVGs are compiled to JS by `react-native-svg-transformer` and do not appear as assets.

Why all 15 families are bundled: 18 files import `{ MaterialCommunityIcons } from "@expo/vector-icons"`. The package's `main` is `build/IconsLazy.js`, which despite its name executes `require("./AntDesign")`, `require("./Entypo")`, and so on for every family at module top level (lines 121–139). Each family module statically imports its `.ttf`, so Metro registers all 19 font files as assets. `components/ui/icon-symbol.tsx` already uses the correct deep import `@expo/vector-icons/MaterialIcons`.

## 4. Repository assets (measured, `find assets -type f -printf`)

| Bytes | Path | Dimensions | Bundled? |
|---|---|---|---|
| 393,493 | `assets/images/icon.png` | 1024×1024 RGB | No; consumed by prebuild to generate platform icons |
| 78,796 | `assets/images/android-icon-foreground.png` | 512×512 RGBA | No; prebuild input |
| 21,252 / 14,225 / 6,341 | `assets/images/react-logo@3x/@2x/.png` | 300/200/100 px | No; never imported (template leftovers) |
| 17,549 | `assets/images/android-icon-background.png` | 512×512 RGBA | No; prebuild input |
| 17,547 | `assets/images/splash-icon.png` | 1024×1024 indexed | No; prebuild input for expo-splash-screen |
| 14,394 / 13,924 | `assets/button-export-tool.html`, `assets/youtube-controls-export-complete.html` | — | No; design-tool exports tracked in git |
| 5,075 | `assets/images/partial-react-logo.png` | 518×316 indexed | **Yes** (placeholder) |
| 4,140 | `assets/images/android-icon-monochrome.png` | 432×432 RGBA | No; prebuild input |
| 1,129 | `assets/images/favicon.png` | 48×48 | Web only |
| 977 / 976 | `assets/icons/shorts-active.svg`, `shorts-inactive.svg` | 512 viewBox | Compiled into JS via svg transformer |
| 320,405 | `VIDEO_FEED_IMPLEMENTATION_GUIDE.zip` (repository root) | — | No; tracked in git, not an app asset |

Total `assets/` on disk: 589,818 B. Only 5,075 B of it reaches the bundle.

## 5. Quality gate baseline (measured)

| Gate | Result | Command |
|---|---|---|
| TypeScript | 3,068 errors: 3,039 in `__tests__/` (dominant codes TS2304 "Cannot find name describe/it/expect", TS2593, TS2708 — Jest globals are not visible to `tsc` under TypeScript 6.0.3 with the current `tsconfig.json`), 29 in runtime source (Comments 16, `icon-symbol.tsx` 2, `use-theme-color.ts` 2, `useVoiceSearch.ts` 2 including `Cannot find module 'expo-speech'`, `GlobalErrorLogger.ts` 1, `PlaybackEngine.ts` 1, `useTapGestures.ts` 1, `PlayerSurface.tsx` 1, `ShortCard.tsx` 1, `ShortsSearchBar.tsx` 1, `useShortsPlayer.ts` 1) | `npx tsc --noEmit` |
| ESLint | 429 problems (78 errors, 351 warnings) | `npm run lint` |
| Jest | 95 suites: 80 passed, **15 failed to run**; 652 tests passed in the suites that ran. All 15 failures share one cause: `TypeError: Cannot read properties of undefined (reading 'loadUnpackers')` raised from `react-native-reanimated/mock` when `__tests__/harness/setup.ts:40` calls `jest.requireActual("react-native-reanimated/mock")`. Reanimated 4.5 expects the `react-native-worklets` mock to be installed first (`node_modules/react-native-worklets/src/mock.ts` exists). Failing suites: `Comments`, `actions/VideoActionBar`, `player/gestures/useControlsVisibility`, `player/ui/{ControlButton, controls, ControlsOverlay, EndScreen, MiniPlayer, PlayPauseButton, ProgressBar, SkipButton, transient}`, `player/VideoPlayer.{parity, root, root.perf}` | `npm test` |
| Web Jest project | not run in baseline | `npm run test:web` |

The 15 failing suites are the player UI and root regression suites — precisely the safety net needed for any change that touches player files. Restoring them is Phase 0 work (change C-01) and is a test-harness fix, not a player change.

Note on `expo-speech`: `hooks/useVoiceSearch.ts` imports `expo-speech`, which is not installed. The export still succeeds because the `Speech` binding is never used and Babel's TypeScript transform elides unused imports; the string `expo-speech` does not appear in the bundle. `tsc` correctly reports it. The hook itself is reachable (Shorts search bar).

## 6. Native and device metrics (NOT MEASURED)

| Metric | Status | How to measure (Phase 0 for baseline, Phase 9 for result) |
|---|---|---|
| Android release AAB size | NOT MEASURED — no native project, no `android.package`, no `eas.json` | After D-1 and D-2: `npx expo prebuild -p android` then `cd android && ./gradlew :app:bundleRelease`; size of `android/app/build/outputs/bundle/release/app-release.aab`. Or `eas build -p android --profile production --local`. |
| Play-delivered download size per ABI | NOT MEASURED | `bundletool build-apks --bundle=app-release.aab --output=app.apks --mode=default` then `bundletool get-size total --apks=app.apks --dimensions=ABI,SCREEN_DENSITY`. Report arm64-v8a and armeabi-v7a separately. |
| Universal APK size | NOT MEASURED | `bundletool build-apks --mode=universal`; or `./gradlew :app:assembleRelease` (universal by default). |
| Installed size | NOT MEASURED (device needed; deferred per instruction) | `adb shell dumpsys package <pkg>` for `codePath`, then `adb shell du -sh <codePath>`; or Settings → Apps. |
| Native library bytes per ABI | NOT MEASURED | `unzip -l app-universal.apk` filtered to `lib/` and grouped by ABI; or Android Studio APK Analyzer. |
| Debug APK size | NOT MEASURED | `./gradlew :app:assembleDebug`. Reported for completeness only; not a target. |
| iOS IPA / App Store thinned size | NOT MEASURED (requires macOS/Xcode or EAS iOS build) | `eas build -p ios --profile production` then App Store Connect "App File Sizes" report, or Xcode Organizer → App Thinning Size Report. |
| Cold start / TTI | NOT MEASURED (device needed; deferred) | `adb shell am start -W -n <pkg>/.MainActivity` (TotalTime), 10 runs, median; TTI via a `performance.now()` mark at first paint in `app/_layout.tsx`, logged in dev builds only. |
| Memory | NOT MEASURED (device needed; deferred) | `adb shell dumpsys meminfo <pkg>` at the home screen and during HLS playback. |
| Video startup time / stability | NOT MEASURED (device needed; deferred) | Engine timestamps: `loading` → `playing` transition in `PlaybackEngine` logged via `devLog` on a dev build against the demo MP4 and HLS sources. |

## 7. Baseline table (summary)

| Metric | Baseline | Measurement method | Target | Status |
|---|---|---|---|---|
| Android HBC bundle | 4,941,796 B | `expo export --platform android` | ≤ baseline; small decrease expected from C-09 and C-11 | Measured |
| iOS HBC bundle | 4,750,938 B | `expo export --platform ios` | ≤ baseline | Measured |
| Bundled assets, Android | 5,071,209 B / 47 files | export `metadata.json` | ≤ 2,658,869 B / 30 files after C-08 (5,071,209 − 2,412,340; 47 − 17) | Measured; target derived from measured font sizes |
| Bundled assets, iOS | 4,105,051 B / 43 files | same | ≤ 1,692,711 B / 26 files after C-08 | Measured; derived |
| Vector-icon TTFs bundled | 19 | export log | 2 (`MaterialCommunityIcons`, `MaterialIcons`) | Measured |
| Autolinked Expo modules (Android) | 23 | autolinking resolve | 20 after C-04 (expo-audio, expo-linear-gradient, expo-web-browser removed) | Measured |
| Autolinked RN modules (Android) | 11 | autolinking react-native-config | 9 after C-04 and C-09 (slider, svg removed); 10 if C-09 is rejected | Measured |
| `dependencies` entries | 50 | `package.json` | 30 after C-04, C-05, C-06 (see dependency-audit §5) | Measured |
| Release AAB size | NOT MEASURED | §6 | Record in Phase 0; target: decrease, magnitude unknown until measured | — |
| Cold start | NOT MEASURED | §6 | No regression beyond measurement noise | Deferred (device) |
| Jest | 80/95 suites | `npm test` | 95/95 suites before any production change | Measured |
