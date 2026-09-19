# App Size Optimisation — High-Level Design

## 1. Document control

| Field | Value |
|---|---|
| Title | expo-live-player mobile application size optimisation |
| Date | 2026-09-19 |
| Version | 1.0 (design; not yet approved) |
| Author | Principal Mobile Architect role (Claude), from repository evidence |
| Approver | Human owner (ajayramola24@gmail.com) |
| Related | SPEC `docs/superpowers/specs/2026-09-19-app-size-optimization-design.md`; LLD `LLD.md`; plan `docs/superpowers/plans/2026-09-19-app-size-optimization-plan.md`; every document in `docs/size-optimization/` |
| Repository state | `main` at `b3fb438`, Expo SDK 57.0.23 |

## 2. Executive summary

The app ships roughly 10.0 MB of JavaScript and assets on Android (4.94 MB Hermes bytecode plus 5.07 MB of assets) before any native code is counted. 99.4 % of the asset bytes are fonts, and 2.41 MB of those fonts belong to 13 icon families the app never uses; they are bundled because 18 files import icons through the `@expo/vector-icons` barrel. Four native modules and seven JavaScript packages are installed and (for the native ones) compiled into the app without a single import. Android release builds have never been configured, so R8 code shrinking and resource shrinking are off by Expo default and no APK/AAB size exists.

The design removes the unused packages, changes icon imports to deep paths, replaces one SVG dependency with three tiny PNGs, strips development console logging from production JavaScript, and turns on Android shrinking through `expo-build-properties`. It keeps expo-router, expo-video, expo-image, Reanimated, Gesture Handler, and WebView because each backs a required feature. Every change is small, independently revertible, and measured by a committed script before and after. The only reduction stated with confidence today is the 2,412,340 B of unused fonts per platform; native and R8 savings are real but unmeasured until a release build exists (Phase 0).

## 3. Problem statement

Size is not budgeted or measured in this repository. Dependencies were added in bulk (commit `790f900`, 2026-09-09, "Complete YouTube-style video app features") and never pruned. Icon imports follow the convenient but expensive barrel form. No release build configuration exists, so the safest Android size levers have never been applied. The test harness that protects the player is currently broken (15 suites fail on the Reanimated 4 mock), which blocks safe change. Without a baseline, a budget, and a guard, size will keep growing with each feature.

## 4. Goals

1. Ship the smallest practical production artefact without removing any user-facing feature.
2. Establish a measured baseline and a committed measurement tool.
3. Remove every dependency and asset that is provably unused.
4. Configure production builds (Android first) with industry-standard shrinking, validated by playback regression.
5. Leave guards (lint rules, size assertions, documentation) so the result persists.
6. Preserve or improve startup, runtime, and playback performance.

## 5. Non-goals

- No replacement of expo-router, expo-video, expo-image, Reanimated, Gesture Handler, or WebView.
- No rewrite of the player or Shorts; no migration of Shorts to the engine.
- No device-connected measurement (deferred by instruction).
- No fixing of the 3,039 Jest-global TypeScript errors or the 351 lint warnings beyond not adding new ones (flagged, D-9).
- No backend, content, or UX feature work.
- No ejecting from the managed workflow.

## 6. Existing system overview

Yagna is an Expo Router app with four tabs (Home, Live, Shorts, Saved), a video screen with the protected `VideoPlayer` behind `VideoPlaybackContainer`, search and settings screens, local persistence over AsyncStorage, a demo content provider or HTTP API selected by `app.json` `extra`, a YouTube WebView fallback for live, and an app-actions layer (like, save, share, download, clip, report, thanks) over a repository interface. Web is a supported target through platform adapters. See `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md` for the product HLD.

## 7. Current architecture (size view)

See `architecture-diagrams.md` §1 and §4. Key facts: one Hermes bundle per platform; all reachable modules included; assets decided by module reachability; native code decided by autolinking regardless of imports; no native project or release configuration in the repository.

## 8. Current dependency architecture

See `dependency-architecture.md` §1–2 and `optimization/dependency-audit.md`. 50 dependencies, 27 of them with no import site; 23 Expo and 11 community native modules autolinked on Android.

## 9. Current build architecture

See `build-architecture.md` §1. Babel (preset-expo, module-resolver, worklets plugin), Metro (default plus SVG transformer), Hermes; `app.json` without identifiers or build properties; no EAS profiles; no CI.

## 10. Current asset architecture

See `optimization/asset-audit.md`. 5,071,209 B bundled on Android: 19 vector-icon TTFs (4,076,840), Material Symbols TTF via @expo/ui (966,544), router PNG/XML (≈ 27,825), one placeholder PNG (5,075). No media assets are bundled (correct).

## 11. Current video architecture

See `video-architecture.md`. Engine over one expo-video player; adapters for brightness, haptics, orientation; Reanimated UI; expo-image poster; Shorts separate; WebView live fallback.

## 12. Current size baseline

See `optimization/size-baseline.md`. Android HBC 4,941,796 B; iOS HBC 4,750,938 B; Android assets 5,071,209 B (47 files); iOS assets 4,105,051 B (43 files); AAB/IPA/native NOT MEASURED.

## 13. Root causes of size

| # | Root cause | Evidence | Addressed by |
|---|---|---|---|
| RC-1 | Barrel import of `@expo/vector-icons` bundles all 15 families | `IconsLazy.js` lines 121–139; export log | C-08 |
| RC-2 | Bulk-added, never-used dependencies with native code | `790f900`; zero imports; autolinking list | C-04, C-05 |
| RC-3 | No release build configuration; shrinking off by default | absent `eas.json`, identifiers, build properties | C-03, C-14 |
| RC-4 | A full SVG runtime for two static icons | attribution 104,413 B; `_layout.tsx` | C-09 |
| RC-5 | Development logging compiled into production | 73 `console.*` sites | C-11 |
| RC-6 | Router internals pull @expo/ui and a 966 KB font on Android | `Stack.js` line 11; attribution | X-1 (deferred), upgrade watch |
| RC-7 | Dev tooling and duplicates listed under `dependencies` | `package.json` | C-06 |
| RC-8 | No measurement, budget, or guard | no script beyond the player-only one; no CI | C-02, C-19 |

## 14. Optimisation principles

1. Measure first, change second, measure again; record the command with the number.
2. One logical change per commit; each independently revertible.
3. Remove only what is proven unused (import scan + `npm ls` + autolinking diff).
4. Prefer configuration and import-path changes over library replacement.
5. Never trade playback correctness or startup time for bytes.
6. Protected modules receive the minimum diff (import path only) and only with the invariants suite green.
7. Anything uncertain becomes a gated experiment (`X-nn`) with an accept/reject rule, never a permanent change by default.
8. Guards outlive the initiative (lint rules, size assertion, documentation).

## 15. Target architecture

Same runtime architecture; smaller module graph, fewer native modules, production-only transforms, and a configured release pipeline. See `architecture-diagrams.md` §2, §3, §5.

## 16. Target dependency architecture

See `dependency-architecture.md` §3–4. 29–30 dependencies; 20 Expo + 9 RN native modules on Android; ESLint guards; audit table maintained.

## 17. Target build architecture

See `build-architecture.md` §2. Babel `env.production` console removal; Metro defaults; `expo-build-properties` with R8 and resource shrinking; `eas.json` profiles; `size:export`/`size:report`/`typecheck` scripts; budget assertion.

## 18. Target asset architecture

Android ≈ 2.65 MB bundled assets (two icon fonts, router assets, Material Symbols pending X-1, three tiny PNGs); iOS ≈ 1.69 MB. No first-party raster except the tab icon; placeholder via blurhash (D-5).

## 19. Target video architecture

Unchanged behaviour and structure. Three player UI files change one import line each; R1–R9 remain green. See `video-architecture.md` §4.

## 20. JS bundle strategy

Deep icon imports; drop SVG runtime; production console stripping; measurement by source-map attribution; no undocumented tree shaking; no code splitting (not available for native bundles). See `optimization/bundle-optimization.md`.

## 21. Native dependency strategy

Uninstall unused native packages; remove SVG; keep media/animation/navigation stack; R8 with playback verification; report autolinking counts in every size report; watch router upgrades for @expo/ui laziness.

## 22. Expo strategy

Stay on the managed workflow. Use `npx expo install` for version alignment, `expo-build-properties` for native build flags, `expo prebuild` only to produce measurable artefacts (git-ignored). Do not use `expo.autolinking.exclude` for anything with an eager `requireNativeModule` (documented for @expo/ui). Keep `experiments.reactCompiler` and `typedRoutes` as they are.

## 23. Android strategy

Four-number reporting (AAB, arm64 download, armv7 download, universal APK); AAB to Play; R8 and resource shrinking on; keep four ABIs in the AAB; local Gradle or EAS build per D-2; `bundletool` for per-ABI sizes; permission list diffed before and after. See `optimization/android-optimization.md`.

## 24. iOS strategy

Same dependency removals apply to pods. App thinning handled by the App Store. Optional experiment X-3 (`expo-image.disable-libdav1d`) only with a backend guarantee that AVIF is never served (D-6). Measurement requires EAS iOS or a Mac; deferred to Phase 9 with EAS.

## 25. Performance strategy

Every change is evaluated in `optimization/performance-impact.md`; emulator-based relative measurements in Phase 9; device absolutes deferred. Expected direction: neutral or improving for every change; R8 requires explicit playback verification.

## 26. Security considerations

- Removing expo-audio, expo-web-browser, and slider reduces the native attack surface and may remove manifest permissions/queries; the permission list is diffed in Phase 9.
- Console stripping removes stray logging of request data in production (none of the 73 sites was found to log secrets, but the Comments composer logs user-entered text in development).
- R8 obfuscation makes production stack traces unreadable without `mapping.txt`; the build step must retain it.
- No change touches TLS, auth, storage keys, or the WebView allow-list. `LiveEmbedView` and `YOUTUBE_EMBED` allow-list are untouched.
- No secrets are involved; `eas.json` contains no credentials.

## 27. Reliability considerations

- The harness fix (C-01) is a precondition: without the 15 player suites, player-file edits are unverified.
- Each change is followed by `tsc`, lint, Jest, export, and size report; failure reverts the change.
- R8 risks are enumerated with detection and mitigation (`android-optimization.md` §3.2).
- The removal of `react-native-svg` also removes the Jest SVG mock; the tab layout test (`__tests__/navigation/tabLayout.test.tsx`) must be updated to assert the PNG `Image`.

## 28. Observability

Production observability today is `Logger.error/warn` to the console plus the `__DEV__`-only global handlers and analytics sink. C-11 preserves `error` and `warn`. No crash reporter exists; none is added (out of scope), but the design does not remove any path a future reporter would use. The size report script is the initiative's own observability: it prints bundle bytes, asset counts, TTF list, top packages, and autolinking counts.

## 29. Testing strategy

- Unit and component: existing 95 suites (must be 95/95 after C-01) plus new tests: tab icon renders `Image` with the PNG source; ESLint rule fails on a barrel import (lint fixture); `measure-app-size.js` unit test on a fixture export directory; Babel production config removes `console.log` and keeps `console.error` (transform test).
- Static: `npx tsc --noEmit` runtime-source error count must not increase (baseline 29); `npm run lint` error count must not increase (baseline 78).
- Build: `expo export` for android and ios after every change; asset list and counts asserted.
- Emulator regression (Phase 8): the feature matrix in `implementation/regression-matrix.md` on a release build with R8 on.
- Device: deferred.

## 30. Rollback strategy

Every change is a separate commit on `main`; `git revert <sha>` restores the previous state. Package removals are reverted with `git revert` plus `npm ci`. Build-properties and Babel changes are configuration-only. Details per change in `implementation/rollback-plan.md`.

## 31. Risks

See `implementation/risk-register.md`. Top three: R8 stripping media3 or WebView classes (medium likelihood, high impact, detected by emulator playback regression); visual change in the Shorts tab icon (low, low; human sign-off); unknown native baseline making benefit claims unverifiable (certain until Phase 0; mitigated by doing Phase 0 first).

## 32. Trade-offs

| Trade | Chosen | Cost accepted |
|---|---|---|
| Hermes bytecode (larger file) versus JS (smaller file, slower start) | Hermes | ≈ 1.2 MB larger bundle file for faster startup |
| Keep `MaterialCommunityIcons` whole versus subset glyphs | Whole | 1.3 MB font for maintainability |
| Keep expo-image versus RN Image | expo-image | Native codec libraries for caching and poster behaviour |
| Keep @expo/ui via router versus stubbing | Keep | 966 KB font + 66 KB JS on Android until router changes |
| Babel console removal versus editing call sites | Babel | Build-time behaviour differs from dev (documented) |

## 33. Alternatives considered

Detailed in the SPEC §5 and the decision log: three approaches (config-and-hygiene only; config plus gated library replacements; deep restructuring). Approach B (config-first with C-09 as the one small replacement, and X-1/X-3 as gated experiments) is recommended.

## 34. Decision log

`optimization/optimization-decision-log.md` DL-01 to DL-14.

## 35. Architecture diagrams

`architecture-diagrams.md` §1–7.

## 36. Size budget

`optimization/size-budget.md`.

## 37. Success metrics

| Metric | Baseline | Success |
|---|---|---|
| Bundled TTFs (Android) | 20 | 3 (MCI, MaterialIcons, Material Symbols) |
| Bundled asset bytes (Android / iOS) | 5,071,209 / 4,105,051 | ≤ 2,658,869 / ≤ 1,692,711 |
| Autolinked modules (Android Expo / RN) | 23 / 11 | 20 / 9 |
| `dependencies` count | 50 | ≤ 30 |
| HBC bytes (Android / iOS) | 4,941,796 / 4,750,938 | ≤ baseline |
| AAB and per-ABI download | NOT MEASURED | measured in Phase 0 and Phase 9; Phase 9 ≤ Phase 0 |
| Jest | 80/95 | 95/95 |
| tsc runtime-source errors / lint errors | 29 / 78 | ≤ 29 / ≤ 78 (target lower after C-07) |
| Feature matrix | — | all rows pass on emulator release build |

## 38. Acceptance criteria

`implementation/acceptance-criteria.md`, per phase and overall.
