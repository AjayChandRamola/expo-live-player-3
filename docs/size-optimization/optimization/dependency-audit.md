# Dependency Audit — 2026-09-19

Evidence per row: import counts come from `grep -rE "from ['\"]<pkg>(/|['\"])"` over the runtime source directories (`app components constants contexts hooks services types utils`) and separately over `__tests__ __mocks__ scripts`. Native presence is from `ls node_modules/<pkg>/{android,ios}` and the autolinking output in `size-baseline.md` §2. Ownership ("who else depends on it") is from `npm ls <pkg>`. Origin commit is from `git log -S"<pkg>" -- package.json`.

Classification codes: **RR** required runtime · **RB** required build-time · **DEV** development only · **TR** indirect/transitive (installed anyway because another package depends on it) · **RED** potentially redundant · **UN** unused · **REP** replaceable · **HI** high size impact · **LO** low size impact · **NAT** native footprint contributor.

## 1. `dependencies` (50 entries)

| Package | Version | Imports (src / tests) | Native | Class | Purpose and evidence | Disposition |
|---|---|---|---|---|---|---|
| expo | ^57.0.23 | 0 / 0 (imported indirectly by every expo module; `main: expo-router/entry`) | A+I | RR NAT HI | Runtime. Depends on expo-asset, expo-constants, expo-file-system, expo-font, expo-keep-awake, expo-modules-core, @expo/dom-webview, @expo/log-box | Keep |
| expo-router | ~57.0.21 | 12 / 1 | A+I | RR NAT HI | Navigation (`Stack`, `Tabs`, `useRouter`, `Linking`). Pulls @expo/ui, expo-glass-effect (iOS), expo-symbols, masked-view, react-native-screens, react-native-drawer-layout, @radix-ui (web), vaul (web) | Keep |
| react, react-native | ^19.2.3, 0.86.3 | 111 / 84 | — | RR HI | Framework | Keep |
| react-dom, react-native-web | ^19.2.3, ~0.21.0 | 0 / 0 | — | RB (web) | Web target only (`app.json` `web.output: static`; expo-router peers; player web adapters and `jest.web.config.js` exist). Zero bytes in native bundles | Keep pending D-8 |
| expo-video | ~57.0.4 | 7 / 1 | A+I | RR NAT HI | Playback: `PlaybackEngine`, `PlayerSurface`, Shorts, `useShortsPlayer`. Android: media3 exoplayer, hls, dash, session, ui, okhttp datasource | Keep; protected |
| expo-image | ~57.0.5 | 4 / 0 | A+I | RR NAT HI | Thumbnails (`VideoCard`, `UpNextList`, `FeaturedYagnaCard`) and poster (`PlayerSurface`). Android: Glide + AVIF + androidsvg + animated-gif plugin; iOS: SDWebImage + AVIF (libdav1d) + SVG + WebP coders | Keep (see X-3 for the iOS AVIF decoder) |
| react-native-reanimated | 4.5.1 | 11 / 1 | A | RR NAT HI | Player animation (ADR 0003), Shorts, router peer. 773,268 B of unminified JS | Keep |
| react-native-worklets | 0.10.1 | 0 / 0 | A | TR RR NAT | Required peer of Reanimated 4; its Babel plugin is what `react-native-reanimated/plugin` re-exports | Keep |
| react-native-gesture-handler | ~2.32.0 | 5 / 4 | A | RR NAT | Player gestures, Shorts root view, router peer | Keep |
| react-native-screens | ~4.26.0 | 0 / 0 | A+I | TR RR NAT | Direct dependency of expo-router; native stack | Keep (listing it explicitly is harmless and matches Expo's template) |
| react-native-safe-area-context | ~5.7.0 | 5 / 3 | A+I | RR NAT | Safe areas; router peer | Keep |
| @react-native-async-storage/async-storage | ^2.2.0 | 1 / 12 | A+I | RR NAT LO | `services/storage/asyncStorageAdapter.ts` | Keep |
| react-native-webview | 13.16.1 | 1 / 0 | A+I | RR NAT | `components/Live/LiveEmbedView.tsx`; `app.json` `extra.liveSourceFallback: "youtube"` | Keep |
| expo-brightness | ~57.0.2 | 1 / 2 | A+I | RR NAT LO | Player F23 brightness swipe (ADR 0010) | Keep |
| expo-haptics | ~57.0.3 | 3 / 2 | A+I | RR NAT LO | Player F26, `haptic-tab.tsx`, action button | Keep |
| expo-screen-orientation | ~57.0.2 | 1 / 2 | A+I | RR NAT LO | Player F9 orientation adapter | Keep |
| expo-file-system | ~57.0.7 | 1 / 0 | A+I | RR NAT | `services/videoActions/downloadService.ts` (`expo-file-system/legacy`); also an `expo` dependency | Keep |
| expo-constants | ~57.0.18 | 2 / 0 | A+I | RR NAT LO | `contentSourceConfig.ts`, `settings.tsx`; router peer | Keep |
| expo-linking | ~57.0.10 | 1 / 0 | A+I | RR NAT LO | Deep links in `app/_layout.tsx`; router peer | Keep |
| expo-status-bar | ~57.0.1 | 1 / 0 | A | RR LO | `app/_layout.tsx` | Keep |
| expo-splash-screen | ~57.0.9 | 0 / 0 | A+I | RR (plugin) NAT LO | Config plugin in `app.json`; native splash | Keep |
| expo-system-ui | ~57.0.4 | 0 / 0 | A+I | RR NAT LO | Needed for `userInterfaceStyle: automatic` and root background on Android | Keep |
| expo-font | ~57.0.4 | 0 / 0 | A+I | TR RR NAT LO | Used by `@expo/vector-icons` `createIconSet` (`Font.loadAsync`); also an `expo` dependency | Keep |
| expo-asset | ~57.0.17 | 0 / 0 | A+I | TR RR NAT LO | Asset registry; `expo` dependency | Keep |
| expo-symbols | ~57.0.3 | 2 / 0 | I only | RR NAT LO | `components/ui/icon-symbol.ios.tsx` (SF Symbols) and types in `icon-symbol.tsx`; also an expo-router dependency. On Android its `weights` modules bring the 966,544 B Material Symbols font through @expo/ui | Keep |
| @expo/vector-icons | ^15.0.3 | 19 / 0 | — | RR HI (assets) | 51 `MaterialCommunityIcons` uses, 1 `MaterialIcons` use. Barrel import bundles all 15 families (4,076,840 B of TTF) | Keep; change import style (C-08) |
| expo-keep-awake | ~57.0.2 | 0 / 0 | A+I | TR UN LO | Not imported; player sets `player.keepScreenOnWhilePlaying = true` instead (F22). `expo` depends on it for dev tools, so it stays installed and autolinked regardless | Remove from `package.json` (hygiene only; no size effect) |
| expo-audio | ~57.0.5 | 0 / 0 | A+I | UN NAT | Added 2026-09-09 (`790f900`); nothing imports it; expo-video owns the audio session. Nothing else depends on it (`npm ls`) | **Remove** (C-04) |
| expo-linear-gradient | ~57.0.2 | 0 / 0 | A+I | UN NAT | Added `790f900`; no imports; no dependents | **Remove** (C-04) |
| expo-web-browser | ~57.0.3 | 0 / 0 | A+I | UN NAT | From the initial template; no imports; expo-router 57 does not reference it (`grep` of `node_modules/expo-router/build`) | **Remove** (C-04) |
| @react-native-community/slider | 5.2.0 | 0 / 0 | A+I | UN NAT | Added `790f900`; the player's `ProgressBar` is custom (Reanimated); no dependents | **Remove** (C-04) |
| @react-native-masked-view/masked-view | 0.3.2 | 0 / 0 | A+I | TR UN NAT | Direct dependency of expo-router (`^0.3.2`); stays installed and autolinked regardless | Remove from `package.json` (hygiene only) |
| react-native-svg | 15.15.4 | 1 / 0 (+ 2 `.svg` imports in `app/(tabs)/_layout.tsx`) | A | REP NAT | Only consumer is dead file `components/ui/ShortsIcon.tsx` plus the two Shorts tab SVGs via `react-native-svg-transformer`. 104,413 B unminified JS plus a native library | **Replace and remove** (C-09) pending D-4 |
| react-native-paper | ^5.14.5 | 0 / 0 | — | UN | Added `790f900`; no imports; player rule R5 forbids it; feature catalog "Later items" already lists its removal (O3) | **Remove** (C-05) |
| react-native-calendars | ^1.1306.0 | 0 / 0 | — | UN | Added `790f900`; no imports | **Remove** (C-05) |
| react-native-collapsible | ^1.6.2 | 0 / 0 | — | UN | Added `790f900`; no imports | **Remove** (C-05) |
| ajv | ^8.17.1 | 0 / 0 | — | UN | Added `790f900`; no imports (ESLint brings its own ajv 6) | **Remove** (C-05) |
| @expo-google-fonts/mukta, noto-sans-devanagari, roboto | ^0.2.3, ^0.2.3, ^0.4.1 | 0 / 0 | — | UN | Added `790f900`; no `useFonts`/`loadAsync` anywhere; 12 MB on disk; zero bytes in bundle because unreferenced | **Remove** (C-05) |
| @babel/core | ~7.21.0 | 0 / 0 | — | DEV RED | Also in devDependencies (`^7.21.0`); installed 7.29.7 | Remove from `dependencies` (C-06) |
| @types/react, @types/react-dom | ~19.1.10, ~19.1.7 | — | — | DEV RED | Also in devDependencies at ~19.2.x; npm installed 19.2.18 / 19.2.7 | Remove from `dependencies` (C-06) |
| typescript | ~5.9.2 | — | — | DEV RED | Also in devDependencies at ~6.0.3; installed 6.0.3. `CLAUDE.md` says 5.9 — flag | Remove from `dependencies`; pin one version in devDependencies (C-06, D-9) |
| eslint-config-prettier, eslint-plugin-react, eslint-plugin-react-hooks, prettier | various | 0 / 0 | — | DEV | Lint/format tooling; `eslint.config.js` uses only `eslint-config-expo/flat` | Move to devDependencies or remove if unused by config (C-06) |

## 2. `devDependencies` (16 entries)

| Package | Version | Class | Evidence | Disposition |
|---|---|---|---|---|
| jest, jest-expo, @testing-library/react-native, react-test-renderer, @types/jest | 29.7 / 57.0.5 / 13.3.3 / 19.2.3 / 29.5 | DEV RB | `package.json` `jest` preset and setup | Keep |
| eslint, eslint-config-expo, @typescript-eslint/parser, @typescript-eslint/eslint-plugin | 9.38 / 57.0.2 / 8.46 / 8.46 | DEV | `eslint.config.js` | Keep |
| babel-plugin-module-resolver | ^5.0.2 | RB | `babel.config.js` alias `@` | Keep |
| react-native-svg-transformer | ^1.5.2 | RB REP | `metro.config.js` | Remove with C-09 |
| typescript | ~6.0.3 | DEV | Type checking | Keep one pinned version (D-9) |
| @babel/core, @types/react, @types/react-dom | | DEV | Duplicated in `dependencies` | Keep here only |
| npm-force-resolutions | ^0.0.10 | UN | No `resolutions` field in `package.json`; no script calls it; 16 MB on disk | Remove (C-06) |

Zero production-size impact from any devDependency: Metro bundles only what the module graph reaches, and none of these are reachable.

## 3. Transitive packages that matter for size (installed because of `expo` or `expo-router`)

| Package | Brought by | Native | Bundle effect measured | Can it be excluded? |
|---|---|---|---|---|
| @expo/ui 57.0.18 | expo-router (`dependencies`) | A+I (Jetpack Compose foundation, ui, material3 on Android) | 66,571 B JS on Android + 966,544 B Material Symbols TTF on Android | **No.** `expo-router/build/layouts/Stack.js` requires `./stack-utils/toolbar/StackToolbar` at module top level; on Android that chain requires `@expo/ui/jetpack-compose`, whose `ExpoUIModule.ts` calls `requireNativeModule('ExpoUI')` at import time. Excluding the native module via `expo.autolinking.exclude` would throw on startup. See `bundle-optimization.md` §4 and experiment X-1. |
| expo-glass-effect 57.0.3 | expo-router | I only | none on Android | Not without altering expo-router |
| @expo/dom-webview 57.0.1 | expo | A+I | not in JS bundle (no `'use dom'` components) | Autolinked; small; leave |
| @expo/log-box 57.0.4 | expo, expo-router | A+I | dev-only JS | Autolinked; leave |
| react-native-drawer-layout, @radix-ui/*, vaul, standard-navigation | expo-router | — | drawer not imported by app; radix/vaul are web | Leave |
| @expo-google-fonts/material-symbols 0.4.48 | expo-symbols | — | 966,544 B TTF on Android (through @expo/ui) | See @expo/ui row |

## 4. Verification strategy per removal

For each package in C-04, C-05, C-06:

1. `grep -rE "from ['\"]<pkg>(/|['\"])|require\(['\"]<pkg>" app components constants contexts hooks services types utils __tests__ __mocks__ scripts` returns nothing (already true today for every listed package).
2. `npm ls <pkg>` shows no other dependent (already verified for the C-04 and C-05 packages; masked-view and expo-symbols and expo-keep-awake do have dependents and are handled accordingly).
3. After `npm uninstall`, `npx expo-modules-autolinking resolve -p android --json` and `-p ios --json` no longer list the package (for native packages).
4. `npx expo export --platform android` succeeds; `npm test`, `npm run lint`, `npx tsc --noEmit` show no new failures relative to the Phase 0 baseline.
5. `npx expo-doctor` reports no new issues.

## 5. Resulting `dependencies` after C-04, C-05, C-06 (30 entries)

@expo/vector-icons, @react-native-async-storage/async-storage, expo, expo-asset, expo-brightness, expo-constants, expo-file-system, expo-font, expo-haptics, expo-image, expo-linking, expo-router, expo-screen-orientation, expo-splash-screen, expo-status-bar, expo-symbols, expo-system-ui, expo-video, react, react-dom, react-native, react-native-gesture-handler, react-native-reanimated, react-native-safe-area-context, react-native-screens, react-native-web, react-native-webview, react-native-worklets, plus expo-build-properties (added by C-14) and react-native-svg only if D-4 rejects C-09. Count: 29 or 30.

## 6. What was checked and found not to be a problem

- No duplicate versions of React, React Native, Reanimated, Worklets, Screens, Safe Area Context, SVG, or Expo Modules Core in the lockfile.
- No `expo-av`, no `expo-dev-client`, no Flipper, no Sentry/analytics SDK, no moment/lodash/date-fns, no `react-navigation` packages (expo-router 57 vendors its navigation).
- `react-native-reanimated/plugin` in `babel.config.js` is a one-line re-export of `react-native-worklets/plugin`; no change needed.
- `expo-speech` is imported but not installed (see baseline §5); C-07 removes the dead import.
