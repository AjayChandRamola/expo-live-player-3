# Architecture Diagrams

All diagrams are Mermaid. "Current" reflects the repository on 2026-09-19; "Target" reflects the state after changes C-04 to C-14 with D-3 and D-4 approved.

## 1. Runtime module graph — current (what reaches the production bundle)

```mermaid
flowchart TD
  entry["expo-router/entry"] --> layout["app/_layout.tsx"]
  layout --> providers["Settings / Saved / VideoActions / PlayQueue providers"]
  layout --> tabs["app/(tabs)/_layout.tsx"]
  layout --> video["app/video/[id].tsx"]
  layout --> search["app/search.tsx"]
  layout --> settings["app/settings.tsx"]
  tabs --> home["index.tsx"] & live["live.tsx"] & shorts["shorts.tsx"] & saved["saved.tsx"]
  tabs -->|"SVG via transformer"| svg["react-native-svg (104 KB)"]
  tabs --> iconsym["ui/icon-symbol (MaterialIcons deep import)"]
  video --> container["Video/VideoPlaybackContainer"]
  container --> player["VideoPlayer (Player.tsx + engine/platform/gestures/ui)"]
  container --> actions["Video/actions (bar, sheets, repository hook)"]
  player --> expovideo["expo-video"]
  player --> reanimated["react-native-reanimated (773 KB) + worklets"]
  player --> gh["react-native-gesture-handler"]
  player --> adapters["expo-brightness / expo-haptics / expo-screen-orientation"]
  player --> expoimage["expo-image (poster)"]
  shorts --> shortplayer["Shorts/ShortVideoPlayer + useShortsPlayer"] --> expovideo
  shorts --> comments["Comments/* (both modals via barrel)"]
  live --> webview["react-native-webview (YouTube fallback)"]
  home --> feed["VideoFeed/*"] --> expoimage
  barrel["@expo/vector-icons barrel (IconsLazy.js)"]
  player -.->|"3 files"| barrel
  actions -.->|"4 files"| barrel
  shorts -.->|"4 files"| barrel
  comments -.->|"4 files"| barrel
  feedui["Search/SearchInput, ui/IconButton"] -.->|"2 files"| barrel
  barrel --> fonts["19 TTF (4,076,840 B)"]
  entry --> router["expo-router"] --> screens["react-native-screens"]
  router -->|"Android Stack toolbar"| expoui["@expo/ui (66 KB JS) → Material Symbols TTF (966,544 B)"]
```

## 2. Runtime module graph — target

```mermaid
flowchart TD
  entry["expo-router/entry"] --> layout["app/_layout.tsx"]
  layout --> tabs["app/(tabs)/_layout.tsx"]
  tabs -->|"PNG 1x/2x/3x via RN Image"| png["assets/icons/shorts-active.png, shorts-inactive.png"]
  tabs --> iconsym["ui/icon-symbol (MaterialIcons deep import)"]
  layout --> video["app/video/[id].tsx"] --> container["VideoPlaybackContainer"] --> player["VideoPlayer (unchanged behaviour)"]
  container --> actions["Video/actions"]
  player --> expovideo["expo-video"]
  player --> reanimated["reanimated + worklets"]
  player --> adapters["brightness / haptics / orientation"]
  mci["@expo/vector-icons/MaterialCommunityIcons (deep import, 18 files)"]
  player --> mci
  actions --> mci
  tabs --> shorts["shorts.tsx"] --> mci
  shorts --> comments["Comments/*"] --> mci
  mci --> f1["MaterialCommunityIcons.ttf (1,307,660 B)"]
  iconsym --> f2["MaterialIcons.ttf (356,840 B)"]
  entry --> router["expo-router"] --> expoui["@expo/ui + Material Symbols (unchanged; see X-1)"]
  guard["ESLint no-restricted-imports: barrel forbidden"] -.-> mci
```

Removed from the graph: `react-native-svg`, `react-native-svg-transformer`, 17 TTFs, `partial-react-logo.png` (if D-5), `console.log/info/debug` calls (production only).

## 3. Native module inventory — current versus target (Android)

```mermaid
flowchart LR
  subgraph current["Current: 23 Expo + 11 RN modules"]
    direction TB
    c1["expo, modules-core, asset, constants, file-system, font, keep-awake, linking, splash-screen, status-bar, system-ui"]
    c2["expo-video, expo-image, expo-brightness, expo-haptics, expo-screen-orientation"]
    c3["expo-router, @expo/ui, @expo/dom-webview, @expo/log-box"]
    c4["expo-audio ✗, expo-linear-gradient ✗, expo-web-browser ✗"]
    c5["reanimated, worklets, gesture-handler, screens, safe-area-context, async-storage, webview, masked-view"]
    c6["slider ✗, svg ✗"]
  end
  subgraph target["Target: 20 Expo + 9 RN modules"]
    direction TB
    t1["unchanged runtime set"]
    t2["unchanged media set"]
    t3["unchanged router set"]
    t5["reanimated, worklets, gesture-handler, screens, safe-area-context, async-storage, webview, masked-view"]
  end
  current -->|"C-04, C-09"| target
```

✗ = removed by C-04 (expo-audio, expo-linear-gradient, expo-web-browser, slider) or C-09 (svg).

## 4. Build pipeline — current

```mermaid
flowchart LR
  src["TS/TSX source + assets"] --> babel["Babel: babel-preset-expo, module-resolver, worklets plugin, React Compiler"]
  babel --> metro["Metro (expo/metro-config + svg transformer)"]
  metro --> js["Minified JS"] --> hermes["Hermes compiler"] --> hbc["entry.hbc 4.94 MB (Android)"]
  metro --> assets["47 assets 5.07 MB"]
  appjson["app.json (no package id, no build-properties)"] --> prebuild["expo prebuild (not yet run)"]
  prebuild --> gradle["Gradle: R8 off, shrinkResources off, 4 ABIs"]
  hbc --> gradle
  assets --> gradle
  gradle --> aab["AAB — NOT MEASURED"]
  aab --> play["Play: per-ABI/density splits"]
```

## 5. Build pipeline — target

```mermaid
flowchart LR
  src["TS/TSX source + PNG icons"] --> babel["Babel + env.production: transform-remove-console (exclude error, warn)"]
  babel --> metro["Metro (expo/metro-config, no svg transformer)"]
  metro --> hermes["Hermes"] --> hbc["entry.hbc ≤ baseline"]
  metro --> assets["30 assets ≈ 2.66 MB (Android)"]
  appjson["app.json + expo-build-properties (R8 on, shrinkResources on) + package ids"] --> prebuild["expo prebuild"]
  prebuild --> gradle["Gradle: R8 on, resource shrinking on, 4 ABIs"]
  hbc --> gradle
  assets --> gradle
  gradle --> aab["AAB (measured in Phase 9)"]
  aab --> bundletool["bundletool get-size per ABI"]
  aab --> play["Play"]
  measure["scripts/measure-app-size.js --assert size-budget.json"] -.-> hbc
  measure -.-> assets
```

## 6. Asset flow — current versus target

```mermaid
flowchart TD
  subgraph cur["Current bundled assets (Android 5,071,209 B)"]
    a1["19 vector-icon TTF 4,076,840"]
    a2["Material Symbols TTF 966,544"]
    a3["expo-router PNG/XML 27,825 (approx.)"]
    a4["partial-react-logo.png 5,075"]
  end
  subgraph tgt["Target (Android ≈ 2,653,794 B)"]
    b1["MCI + MaterialIcons TTF 1,664,500"]
    b2["Material Symbols TTF 966,544 (router; X-1 deferred)"]
    b3["expo-router PNG/XML 27,825 (approx.)"]
    b4["Shorts tab PNG ×3 (small; to measure)"]
  end
  a1 -->|"C-08"| b1
  a2 --> b2
  a3 --> b3
  a4 -->|"C-10 blurhash"| gone["removed"]
```

## 7. Change control flow (per task)

```mermaid
flowchart LR
  t["Task from plan"] --> test["Write/adjust failing test"] --> impl["Implement"] --> gates["tsc (no new errors) · lint (no new errors) · npm test (95/95)"]
  gates --> export["expo export android + ios"] --> measure["measure-app-size.js vs previous"] --> ok{"Smaller or equal, no regression?"}
  ok -->|yes| commit["Commit on main"] --> next["Next task"]
  ok -->|no| rollback["git revert / restore per rollback-plan.md"] --> record["Record in decision log"]
```
