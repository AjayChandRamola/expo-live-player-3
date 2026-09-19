# App Size Optimisation — Design Specification

| Field | Value |
|---|---|
| Date | 2026-09-19 |
| Status | Proposed; produced from repository discovery, awaiting human review. No code, configuration, or dependency was changed. |
| Scope | Reduce the production footprint of expo-live-player (JS bundle, bundled assets, native modules, Android release configuration) while preserving every feature in `docs/size-optimization/implementation/regression-matrix.md` |
| Out of scope | Replacing expo-router, expo-video, expo-image, Reanimated, Gesture Handler, or WebView; any player or Shorts rewrite; device-connected measurement (deferred by instruction); backend or UX feature work; fixing pre-existing test-only type errors |
| Stack (verified) | Expo SDK 57.0.23, React Native 0.86.3, React 19.2.3, expo-router 57.0.21, expo-video 57.0.4, react-native-reanimated 4.5.1, Hermes, New Architecture, TypeScript 6.0.3 installed |
| Branch | `main`, in place (standing instruction) |
| Package | Full documentation set in `docs/size-optimization/` (start at its `README.md`) |
| Audience | Human approver; implementing agent using the LLD and plan |

---

## 0. How to read this document

Section 1 states the problem with evidence. Section 2 lists the decisions this design proposes and the ones it needs from the human (D-nn). Section 3 is the design at the level needed to approve it; details live in the LLD. Section 4 is the phased outline. Section 5 records the approaches considered. Section 6 is the experiment protocol. Section 7 is the glossary.

## 1. Problem and evidence

1. **Unused icon fonts are 2.41 MB per platform.** 18 files import `MaterialCommunityIcons` from the `@expo/vector-icons` barrel; the package's entry (`build/IconsLazy.js`) requires all 15 families at module top level, so `expo export` bundles 19 TTFs (4,076,840 B) when only two (1,664,500 B) are used.
2. **Unused packages are compiled in.** `expo-audio`, `expo-linear-gradient`, `expo-web-browser`, `@react-native-community/slider` have zero import sites yet are autolinked into Android and iOS. Seven JavaScript-only packages (paper, calendars, collapsible, ajv, three Google font packages) and eight development tools are also listed under `dependencies`. All were added in one commit (`790f900`).
3. **Android release configuration does not exist.** No `android.package`, no `eas.json`, no `expo-build-properties`; Expo's defaults leave R8 and resource shrinking off. No APK/AAB has been measured.
4. **A full SVG runtime serves two static icons** (104,413 B unminified JS plus a native module).
5. **Development logging ships in production** (73 `console.*` sites).
6. **The player's regression suites are broken** (15 Jest suites fail on the Reanimated 4 mock), so player-adjacent edits are currently unverified.
7. **Router-owned cost:** expo-router's Android Stack toolbar pulls `@expo/ui` (66,571 B JS, Jetpack Compose natively) and a 966,544 B Material Symbols font. This is not fixable safely at the app level today.

Baseline numbers and commands: `docs/size-optimization/optimization/size-baseline.md`.

## 2. Decisions

### 2.1 Proposed by this design (approve or amend)

| ID | Decision |
|---|---|
| DL-02 | Fix the Jest harness first (C-01) so the player suites protect every later change. |
| DL-03 | Deep icon imports with an ESLint guard (C-08). |
| DL-04 | Remove the 4 unused native and 7 unused JS packages; move dev tools to devDependencies (C-04, C-05, C-06). |
| DL-09 | Strip `console.log/info/debug` in production through Babel; keep `error`/`warn`; gate `Logger.info/debug` with `__DEV__` (C-11). |
| DL-10 | Enable R8 and resource shrinking through `expo-build-properties`, accepted only after playback regression on a release build (C-14). |
| DL-11 | Rasterise the Shorts tab icon and drop `react-native-svg` (C-09), subject to visual sign-off. |
| DL-06, DL-07, DL-08 | Reject glyph subsetting, library replacements, and stubbing `@expo/ui`. |
| DL-13 | Report Android size as four numbers, never one. |

### 2.2 Needed from the human

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| D-1 ● | Values for `android.package` and `ios.bundleIdentifier` (permanent once published) | Reverse-DNS of the Yagna domain, for example `<org>.yagna.app`; the human must choose | All native builds and measurements |
| D-2 ● | Release build path: local Gradle on this Windows machine (Java 17 and Android SDK present) or EAS (`eas` CLI installed) | Local Gradle for measurement iterations; EAS `production` profile for store artefacts | Phase 0 native baseline, Phase 5 |
| D-3 ● | Allow one-line import-path edits in `app/(tabs)/shorts.tsx`, `components/Shorts/ShortActions.tsx`, `ShortCard.tsx`, `ShortsSearchBar.tsx`, `ShortVideoPlayer.tsx` (Shorts stays a separate experience; R7 is satisfied once committed on `main`) | Approve; without it the barrel remains imported and the 2.41 MB saving is zero | C-08 |
| D-4 | Accept a raster (PNG 1×/2×/3×) Shorts tab icon after seeing side-by-side screenshots | Approve if pixel-equivalent | C-09 |
| D-4b | Accept MCI glyphs replacing MaterialIcons on the Android/web tab bar (−356,840 B) | Optional; approve only if the glyphs look right | C-08b |
| D-5 | Replace the React-logo thumbnail placeholder with a neutral blurhash | Approve (also removes non-Yagna branding) | C-10 |
| D-6 | Will the backend ever serve AVIF thumbnails? | If never: run X-3 on iOS later; otherwise skip | X-3 |
| D-7 | Delete tracked non-app files: `VIDEO_FEED_IMPLEMENTATION_GUIDE.zip`, `assets/*.html`, `react-logo*.png` | Approve (Markdown twin of the zip exists in `docs/history`) | C-07 part |
| D-8 | Web remains a supported target | Yes (keeps react-dom, react-native-web) | C-06 scope |
| D-9 | Pin TypeScript to the installed 6.0.3 (and correct `CLAUDE.md`'s "5.9" and "SDK 54" lines) or to 5.9 | 6.0.3, since `tsc` already runs with it | C-06, C-19 |
| D-10 | Keep Prettier as a devDependency | Keep if the editor uses it (`.vscode/settings.json` check in Phase 1) | C-06 |

## 3. Design

### 3.1 Principles

Measure first and after; one revertible change per commit; remove only what is proven unused; prefer configuration and import-path changes to library swaps; never trade playback or startup for bytes; minimum diff in protected modules; uncertain ideas become gated experiments; guards outlive the work.

### 3.2 Units of change (summary; full detail in `docs/size-optimization/architecture/LLD.md`)

| ID | Change | Files | Expected effect | Decision |
|---|---|---|---|---|
| C-01 | Reanimated 4 / worklets mock in Jest harness | `__tests__/harness/setup.ts` | 95/95 suites | — |
| C-02 | `scripts/measure-app-size.js`, `size-budget.json`, npm scripts, `.gitignore` | new + `package.json` | Repeatable measurement and assertion | — |
| C-03 | Identifiers and `eas.json` | `app.json`, `eas.json` | Enables native builds | D-1, D-2 |
| C-03b | Android baseline build and report | none (ignored outputs) | AAB / per-ABI / universal / libs / dex / permissions | D-1, D-2 |
| C-04 | Uninstall 4 unused native packages | `package.json` | 20/22 Expo, 10 RN modules | — |
| C-05 | Uninstall 7 unused JS packages | `package.json` | 0 B (hygiene); byte-identical export proves it | — |
| C-06 | Dev tooling to devDependencies; drop `npm-force-resolutions`; one TypeScript | `package.json` | Hygiene | D-9, D-10 |
| C-07 | Delete 5 dead modules, 3 unused PNGs; drop `expo-speech` import line | 6 files + 3 assets | tsc 29 → 24 | D-7 |
| C-08 | Deep icon imports in 18 files + lint rule | 18 files, `eslint.config.js` | −2,412,340 B assets per platform | D-3 |
| C-08b | Retire MaterialIcons via MCI mapping | `icon-symbol.tsx` | −356,840 B | D-4b |
| C-09 | PNG tab icon; remove react-native-svg and transformer | `_layout.tsx`, `metro.config.js`, mocks, `package.json` | −104,413 B JS unminified; one native module | D-4 |
| C-10 | Blurhash placeholder | `VideoCard.tsx`, `UpNextList.tsx`, tokens | −5,075 B | D-5 |
| C-11 | Babel `env.production` `transform-remove-console` (keep error/warn); `Logger` `__DEV__` gating | `babel.config.js`, `utils/Logger.ts` | Smaller JS; less runtime logging | — |
| C-12 | Confirm Expo defaults | docs only | — | — |
| C-14 | `expo-build-properties`: R8 + resource shrinking | `app.json`, `package.json` | Native/DEX reduction NOT MEASURED until done | D-1, D-2 |
| C-16 | Video verification only | none | — | — |
| C-17 | Release documentation | docs, README | — | — |
| C-18 | Regression and measurement execution | none | Evidence | — |
| C-19 | Lint guards, budget tightening, doc updates | `eslint.config.js`, docs, `CLAUDE.md` | Persistence | D-9 |

### 3.3 Architecture after the change

Unchanged runtime architecture. Module graph loses 17 fonts, the SVG runtime, and production console calls; native inventory loses 5 modules; build gains a shrinking release pipeline and a size gate. Diagrams: `docs/size-optimization/architecture/architecture-diagrams.md`.

### 3.4 Error handling and states

No user-facing state changes. Build-time failures (export, prebuild, Gradle, R8) are handled by the rollback plan per change. Runtime error paths (`Logger.error`, error card, retry) are preserved by design (C-11 keeps `error`/`warn`).

### 3.5 Testing

Existing 95 suites (restored by C-01) plus new tests: worklets/reanimated harness guard, `measure-app-size` unit test, dependency guard test, lint fixture for the barrel rule, Babel production transform test, updated tab layout and Logger tests. Emulator regression on the release build (Phase 8). Device work deferred.

### 3.6 Security, reliability, observability

Fewer native modules and permissions; `mapping.txt` retained for obfuscated stacks; `Logger.error/warn` preserved; no change to TLS, storage, allow-lists, or auth.

## 4. Phases (outline; the plan document has tasks)

0 Baseline (C-01, C-02, C-03, C-03b) · 1 Dependencies (C-04–C-07) · 2 Assets (C-08, C-08b, C-09, C-10) · 3 JavaScript (C-11) · 4 Expo config (C-12) · 5 Android (C-14) · 6 Video verification (C-16) · 7 Production build docs (C-17) · 8–9 Regression and measurement (C-18) · 10 Hardening (C-19).

After each change: `npm run typecheck` (count), `npm run lint` (count), `npm test`, `npm run size:export`, `npm run size:report`, compare, commit or roll back.

## 5. Approaches considered

| Approach | Description | Assessment |
|---|---|---|
| A. Configuration and hygiene only | C-01–C-08, C-11, C-14 | Lowest risk; captures the certain 2.41 MB and the Android shrinking lever; leaves SVG runtime |
| **B. A plus one small replacement and gated experiments (recommended)** | A + C-09 (SVG → PNG) + C-10, with X-1/X-3 documented but off | Same low risk profile; C-09 is a two-file visual change with sign-off; experiments cannot regress anything unless accepted |
| C. Deep restructuring | Replace expo-router with bare react-navigation, Reanimated with RN Animated, expo-image with RN Image, subset icon glyphs, stub @expo/ui | Largest theoretical saving; violates the brief's constraints (breaks Expo Router, player ADR 0003), high regression and maintenance cost; rejected |

## 6. Experiments (A/B protocol)

Baseline → apply → `size:export` + `size:report` → release build where relevant → regression rows → compare → accept (commit, tighten budget, log) or reject (revert, log).

| ID | Experiment | Accept if | Status |
|---|---|---|---|
| X-1 | Stub `@expo/ui/jetpack-compose` on Android via Metro resolver and exclude its native module | Launch and full matrix pass; Android assets −966,544 B | Deferred; not recommended (patches router internals) |
| X-3 | `expo-image.disable-libdav1d` on iOS | D-6 says no AVIF; thumbnails render; IPA smaller | Needs D-6 and an iOS build |
| X-4 | C-08b MaterialIcons retirement | Human accepts glyphs | Needs D-4b |

## 7. Glossary

**AAB** Android App Bundle uploaded to Play. **ABI** CPU architecture slice (arm64-v8a, armeabi-v7a, x86, x86_64). **Autolinking** Expo's mechanism that compiles every installed native module regardless of JS imports. **Barrel** a module that re-exports many modules (`@expo/vector-icons` index). **HBC** Hermes bytecode bundle. **R8** Android's code shrinker/optimiser. **Resource shrinking** removal of unreferenced Android resources at build. **R1–R9** player dependency rules enforced by `__tests__/player/invariants.test.ts`. **Universal APK** a single APK containing all ABIs and densities.
