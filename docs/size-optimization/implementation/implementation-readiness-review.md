# Implementation Readiness Review — 2026-09-19

## Fully understood (from repository evidence)

- The complete module graph that reaches the production bundle, by package and by first-party area, from source-map attribution of a real `expo export`.
- The exact mechanism by which 19 icon fonts are bundled (`@expo/vector-icons/build/IconsLazy.js` eager requires) and the 18 files that trigger it.
- The exact origin of the 966,544 B Material Symbols font on Android (`expo-router → Stack.js → stack-utils/toolbar → @expo/ui/jetpack-compose → expo-symbols Android weights → @expo-google-fonts/material-symbols`) and why it cannot be safely excluded.
- Which dependencies have zero import sites, which of those are native, and which are owned by `expo`/`expo-router` and therefore stay installed.
- The player's public contract, protected rules R1–R9, the feature catalogue, and the three player UI files whose only change is an import line.
- The current build pipeline and its gaps (no identifiers, no EAS profiles, no build properties, shrinking off by default).
- The state of the quality gates: 15 suites failing on a known Reanimated 4 mock cause; 29 runtime-source type errors; 78 lint errors.

## Confirmed by repository evidence (numbers)

Android HBC 4,941,796 B; iOS HBC 4,750,938 B; Android assets 5,071,209 B in 47 files; iOS assets 4,105,051 B in 43 files; 4,076,840 B of vector-icon fonts of which 2,412,340 B are unused; 23/25 Expo modules and 11 RN modules autolinked; 50 dependencies, 27 unimported; `react-native-svg` 104,413 B unminified for two icons; 73 `console.*` sites.

## Requires measurement (Phase 0 before, Phase 9 after)

- Android AAB size, per-ABI download size, universal APK size, `lib/` bytes per ABI, DEX bytes, resource bytes, permission list.
- iOS IPA / thinned size (EAS iOS build).
- Effect of C-04 and C-09 on native size; effect of C-14 (R8, resource shrinking).
- HBC delta from C-09 and C-11.
- Emulator cold start, feed scroll, and playback-start protocol values (relative only).

## Remains uncertain

- Whether `expo-build-properties` for SDK 57 exposes exactly `enableProguardInReleaseBuilds` / `enableShrinkResourcesInReleaseBuilds` (to verify in `pluginConfig.d.ts` after install).
- Whether any R8 keep rule is needed for media3/WebView (find out by regression, not by guessing).
- Whether the worklets mock deep path (`react-native-worklets/lib/module/mock`) loads under Jest's CommonJS transform (fallback path given in C-01).
- Whether the backend will ever serve AVIF (decides X-3).
- The human's choices D-1 to D-10.

## Must NOT change

- `components/VideoPlayer/engine/**`, `components/VideoPlayer/platform/**`, `components/VideoPlayer/Player.tsx`, `components/VideoPlayer/types.ts`, `constants.ts`, `tokens.ts`, `ui/PlayerSurface.tsx` — zero diffs.
- `components/Shorts/**` and `hooks/useShortsPlayer.ts` beyond the four one-line import changes in C-08 (and only with D-3).
- `contexts/PlayQueueContext.tsx`, `services/**`, `constants/config.ts` (feature flags, media rules, YouTube allow-list).
- `app.json` `extra`, `scheme`, `orientation`, `plugins` for router and splash, `ios.infoPlist.UIBackgroundModes`.
- expo-router, expo-video, expo-image, Reanimated, Gesture Handler, WebView, Screens, Safe Area, AsyncStorage, brightness, haptics, orientation, file-system, symbols, splash, system-ui, status-bar, constants, linking, font, asset.
- Hermes, New Architecture, React Compiler, typed routes.

## Recommended implementation order

Phase 0 (C-01, C-02, C-03 after D-1/D-2, C-03b) → Phase 1 (C-04, C-05, C-06, C-07) → Phase 2 (C-08 non-Shorts, C-08 Shorts after D-3, C-09 after D-4, C-10 after D-5) → Phase 3 (C-11) → Phase 4 (C-12) → Phase 5 (C-14) → Phase 6 (C-16) → Phase 7 (C-17) → Phases 8–9 (C-18) → Phase 10 (C-19). Each change: tests first, GATES, export, size report, commit.

## Highest-value optimisations

1. C-08 deep icon imports: 2,412,340 B per platform, certain.
2. C-14 R8 and resource shrinking: unmeasured but the standard largest native lever.
3. C-04 unused native modules: unmeasured native reduction plus smaller module registry.
4. C-09 SVG removal: 104 KB JS plus a native library.

## Highest-risk optimisations

1. C-14 (R8 keep rules; requires playback regression on a release build).
2. C-09 (visual sign-off; touches Metro/Jest config).
3. C-08's Shorts commit (R7 process; needs D-3).
4. X-1 (rejected for now).

## Expected size reduction

Stated only where evidence supports it: bundled assets −2,412,340 B raw per platform from C-08 (Android 5,071,209 → ≤ 2,658,869; iOS 4,105,051 → ≤ 1,692,711), optionally −356,840 B more from C-08b and −5,075 B from C-10. Unminified JS −104,413 B from C-09 (HBC delta not yet measured). Native, DEX, AAB, IPA: NOT MEASURED; no percentage is claimed.

## Metrics that must be measured after implementation

`size:report` for Android and iOS (bundle bytes, asset bytes and count, TTF list, top packages, autolinking counts); the four Android numbers; iOS via EAS; permission list diff; emulator protocol rows; Jest 95/95; runtime tsc and lint error counts; regression matrix results per row.

## Open decisions for the human (blocking marked ●)

| ID | Decision | Blocks |
|---|---|---|
| D-1 ● | `android.package` and `ios.bundleIdentifier` values | C-03, C-03b, C-14, all native measurement |
| D-2 ● | Local Gradle (Windows, Java 17, SDK present) versus EAS cloud/local for release builds | C-03b, C-14 |
| D-3 ● | Approve import-line-only edits to the 4 Shorts files (R7 spirit preserved) | C-08 full benefit |
| D-4 | Approve raster Shorts tab icon (screenshots provided during Phase 2) | C-09 |
| D-4b | Approve MCI glyphs for Android tab bar | C-08b |
| D-5 | Approve blurhash placeholder instead of the React logo | C-10 |
| D-6 | Backend AVIF guarantee | X-3 |
| D-7 | Delete tracked non-app files (`VIDEO_FEED_IMPLEMENTATION_GUIDE.zip`, two HTML exports, react-logo PNGs) | C-07 part |
| D-8 | Confirm web remains a supported target (keeps react-dom, react-native-web) | C-06 scope |
| D-9 | TypeScript version to pin (6.0.3 as installed, or 5.9 per CLAUDE.md) and permission to correct `CLAUDE.md` | C-06, C-19 |
| D-10 | Keep Prettier as a devDependency? | C-06 |

Without D-1 and D-2, Phases 1–3 can still be executed and measured at the JS/asset level; only native measurement waits.
