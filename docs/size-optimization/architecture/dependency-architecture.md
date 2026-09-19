# Dependency Architecture — Current and Target

## 1. Current: how a source import becomes app bytes

```
source import  →  direct dependency  →  transitive dependencies  →  native module (autolinked)  →  generated native code (prebuild)  →  Gradle/CocoaPods artefact
```

Three mechanisms decide what ships:

1. **Metro module graph** decides JavaScript and assets. Anything reachable from `expo-router/entry` through `import`/`require` is included, including assets referenced by `require('./x.ttf')` inside packages. Anything unreachable ships nothing. Evidence: unreferenced packages such as `react-native-paper` contribute zero bytes; the referenced `@expo/vector-icons` barrel contributes 19 fonts.
2. **Expo autolinking** decides native code. Every package in `node_modules` that has an `expo-module.config.json` (Expo modules) or a `react-native.config`-style native project (community modules) is compiled in, **whether or not JavaScript imports it**. Evidence: `expo-audio`, `expo-linear-gradient`, `expo-web-browser`, `@react-native-community/slider` appear in the autolinking output with zero import sites. Exclusion is possible via `expo.autolinking.exclude` in `package.json`, but only when no JavaScript path calls `requireNativeModule` for that module at import time.
3. **Config plugins** in `app.json` decide native configuration (permissions, splash, build properties). Today: `expo-router`, `expo-splash-screen`.

## 2. Current direct dependency map (runtime-relevant)

| Consumer area | Direct packages imported | Transitive packages they pull that matter |
|---|---|---|
| App shell (`app/_layout.tsx`, tabs) | expo-router, expo-status-bar, expo-linking, react-native-reanimated (side-effect import), expo-symbols (iOS icon), @expo/vector-icons (MaterialIcons deep), react-native-svg (via `.svg` imports) | expo-router → react-native-screens, @expo/ui, expo-glass-effect (iOS), masked-view, react-native-drawer-layout, expo-constants, expo-linking; @expo/ui → expo-symbols Android weights → @expo-google-fonts/material-symbols |
| Player | expo-video, react-native-reanimated, react-native-gesture-handler, react-native-safe-area-context, expo-image, expo-brightness, expo-haptics, expo-screen-orientation, @expo/vector-icons (barrel) | reanimated → react-native-worklets |
| Actions and services | @react-native-async-storage/async-storage, expo-file-system/legacy, expo-constants, @expo/vector-icons (barrel) | — |
| Feed, search, comments, shorts | expo-image, @expo/vector-icons (barrel), react-native-gesture-handler, expo-video (Shorts) | — |
| Live | react-native-webview | — |
| Unused but installed and autolinked | expo-audio, expo-linear-gradient, expo-web-browser, @react-native-community/slider, expo-keep-awake (expo dep), @react-native-masked-view/masked-view (router dep) | — |
| Unused, JS-only | react-native-paper, react-native-calendars, react-native-collapsible, ajv, @expo-google-fonts/{mukta, noto-sans-devanagari, roboto} | — |
| Misplaced dev tooling | @babel/core, @types/react, @types/react-dom, typescript, prettier, eslint-config-prettier, eslint-plugin-react, eslint-plugin-react-hooks | — |
| Web only | react-dom, react-native-web | — |

## 3. Target direct dependency map

`dependencies` (29–30): @expo/vector-icons, @react-native-async-storage/async-storage, expo, expo-asset, expo-brightness, expo-build-properties (new, config plugin), expo-constants, expo-file-system, expo-font, expo-haptics, expo-image, expo-linking, expo-router, expo-screen-orientation, expo-splash-screen, expo-status-bar, expo-symbols, expo-system-ui, expo-video, react, react-dom, react-native, react-native-gesture-handler, react-native-reanimated, react-native-safe-area-context, react-native-screens, react-native-web, react-native-webview, react-native-worklets, [react-native-svg only if D-4 rejects C-09].

`devDependencies` (16): @babel/core, @testing-library/react-native, @types/jest, @types/react, @types/react-dom, @typescript-eslint/eslint-plugin, @typescript-eslint/parser, babel-plugin-module-resolver, babel-plugin-transform-remove-console (new), eslint, eslint-config-expo, jest, jest-expo, react-test-renderer, typescript (one version, D-9), [react-native-svg-transformer only if D-4 rejects C-09]. `npm-force-resolutions` removed; the four lint/format packages removed unless the human wants Prettier (D-10: they are not referenced by `eslint.config.js`; `prettier` may be used from the editor — `.vscode/settings.json` should be checked in Phase 1 before removal).

## 4. Rules that keep the target state

| Rule | Enforcement | Change |
|---|---|---|
| No `@expo/vector-icons` barrel import | ESLint `no-restricted-imports` with a message pointing to the deep path | C-08 |
| No import of removed packages | They are uninstalled; TypeScript and Metro fail on any new import | C-04, C-05 |
| Every new dependency is recorded in `optimization/dependency-audit.md` with import sites and native presence | Review checklist in `acceptance-criteria.md`; CI size assertion catches asset/JS growth | C-19 |
| Player rules R1–R9 | `__tests__/player/invariants.test.ts` | unchanged |
| Autolinking list is part of the size report | `scripts/measure-app-size.js` prints `expo-modules-autolinking resolve` counts for android and ios | C-02 |

## 5. Transitive chains worth remembering on upgrades

- `expo-router → @expo/ui → (Android) Jetpack Compose + Material Symbols font`. Re-check on every router upgrade whether the toolbar import became lazy; if so, the 966,544 B font and 66,571 B JS disappear without any app change.
- `expo → expo-keep-awake`: stays installed; the player does not use it (F22 uses the expo-video property).
- `react-native-reanimated → react-native-worklets`: version-paired; upgrade together.
- `@expo/vector-icons → expo-font`: font loading is lazy per family at runtime; bundling is decided by the import path (deep versus barrel).
