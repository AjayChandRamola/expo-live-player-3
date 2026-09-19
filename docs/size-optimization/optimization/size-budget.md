# Mobile Size Budget — 2026-09-19

The budget is expressed per category. Where the current value is measured, it is stated with its source in `size-baseline.md`. Where it is not measurable today (native libraries, final AAB/IPA), the budget row says NOT MEASURED and names the Phase 0 measurement that will fill it in. Budgets are ceilings that the CI size check (C-19) will enforce once Phase 0 numbers exist.

## 1. Budget by category

| Cat. | Component | Current (raw) | Why it exists | Required? | Reducible? | Optimisation | Risk | Expected benefit | Budget after this initiative |
|---|---|---|---|---|---|---|---|---|---|
| A | First-party JavaScript | 322,493 B unminified (of 3,698,125) | App code | Yes | Marginally (dead modules are already excluded by Metro; console calls) | C-07 dead-code removal (0 B bundle effect), C-11 console stripping | Low | Small JS reduction, less runtime logging work | ≤ 322,493 B unminified |
| B | React / React Native | 628,594 + polyfills (unmapped share of 737,770) | Framework | Yes | No | None | — | — | Tracks RN version |
| C | Expo runtime and router | expo 98,671; expo-router 454,058; @expo/ui 66,571; screens 62,672; expo-modules-core 13,923; small modules ≈ 45,000 | Navigation and module system | Yes | Only by removing unused modules (C-04) | C-04 | Low | Fewer autolinked modules (23 → 20 Expo, 11 → 9 RN on Android) | ≤ current JS; native NOT MEASURED |
| C′ | Animation and gestures | reanimated 773,268; worklets 92,637; gesture-handler 106,977 | Player (ADR 0003), Shorts, router peers | Yes | No | None | — | — | Tracks versions |
| D | Native libraries (`.so` per ABI, iOS frameworks) | NOT MEASURED | media3 (expo-video), Glide/AVIF/androidsvg (expo-image), Compose (@expo/ui via router), Reanimated/Worklets, Hermes, RN core, WebView, SVG, Screens, Safe Area, Gesture Handler, Brightness, Haptics, Orientation, File System, Font, Asset, Constants, Linking, Splash, System UI, Keep Awake, Audio*, Linear Gradient*, Web Browser*, Slider*, Masked View | * are unused today | Yes for * (C-04) and SVG (C-09); R8 shrinking (C-14) | C-04, C-09, C-14 | Medium (R8 keep rules) | Fewer libraries; smaller DEX | Set from Phase 0 AAB measurement: budget = baseline − measured savings |
| E | Fonts (bundled TTF) | 5,043,384 B (19 vector-icon TTFs 4,076,840 + Material Symbols 966,544 on Android) | Icons | Only 1,664,500 B is used | Yes | C-08 (−2,412,340), optional C-08b (−356,840) | Low | Largest single certain win | ≤ 2,631,044 B Android (1,664,500 + 966,544); ≤ 1,664,500 B iOS |
| F | Images (bundled) | 5,075 B | Placeholder | Replaceable | Yes | C-10 | Low | −5,075 B | 0 B first-party images |
| G | Icons (SVG compiled to JS) | 2 SVGs → part of the 104,413 B `react-native-svg` JS + native | Shorts tab | Yes (visual) | Yes | C-09 raster + drop SVG | Low–Medium (visual sign-off) | −104,413 B JS, one native library | 0 B `react-native-svg` |
| H | Static assets from libraries | 27,825 B (expo-router PNG/XML) | Router | Yes | No | None | — | — | Tracks router |
| I | Video-related assets | 0 B (all media remote) | — | — | — | Keep it that way | — | — | 0 B |
| J | Configuration | `app.json` 1,476 B; `metadata.json` | — | Yes | — | None | — | — | — |
| K | Other packaged resources (Android res, manifest, DEX) | NOT MEASURED | Generated at build | Yes | Resource shrinking (C-14) | C-14 | Medium | Smaller APK resources | Set from Phase 0 |

## 2. Total budget

| Artefact | Baseline | Target after initiative | Basis |
|---|---|---|---|
| Android bundled assets | 5,071,209 B | ≤ 2,658,869 B (C-08 only); ≤ 2,296,954 B with C-08b and C-10 | Measured font sizes |
| iOS bundled assets | 4,105,051 B | ≤ 1,692,711 B (C-08 only); ≤ 1,330,796 B with C-08b and C-10 | Measured font sizes |
| Android HBC | 4,941,796 B | ≤ 4,941,796 B; decrease expected from C-09 and C-11 (NOT MEASURED until done) | Baseline |
| iOS HBC | 4,750,938 B | ≤ 4,750,938 B | Baseline |
| Android AAB (Play, arm64-v8a download) | NOT MEASURED | Baseline − (asset delta ≈ 2.4 MB) − native delta (NOT MEASURED) − R8 delta (NOT MEASURED) | Phase 0 and Phase 9 |
| iOS thinned IPA | NOT MEASURED | Baseline − asset delta − native delta | Phase 9 (requires macOS or EAS iOS) |

No percentage reduction is claimed. The only reduction stated with confidence is the 2,412,340 B raw asset reduction from C-08, because it is arithmetic on measured file sizes and a verified bundling mechanism.

## 3. Prioritisation matrix

Scoring: Value = expected bytes removed and certainty; Effort = files touched and testing needed; Risk = chance of functional or visual regression.

| Rank | Change | Value | Effort | Risk | Decision needed | Phase |
|---|---|---|---|---|---|---|
| 1 | C-08 deep icon imports (18 files, 1 ESLint rule) | Very high, certain (2.41 MB/platform) | Low | Low (import path only; no test mocks vector-icons) | D-3 for the 4 Shorts files | 2 |
| 2 | C-14 R8 + resource shrinking via expo-build-properties | High, NOT MEASURED | Low config, medium verification (keep rules; full device regression) | Medium | D-1, D-2 | 5 |
| 3 | C-04 remove 4 unused native packages | Medium, NOT MEASURED natively | Low | Low | — | 1 |
| 4 | C-09 drop react-native-svg | Medium (104 KB JS + native) | Low–medium (3 PNGs, 5 config/file edits) | Low–medium (visual) | D-4 | 2 |
| 5 | C-11 strip console in production | Low–medium JS, runtime win | Low | Low (keeps error/warn) | — | 3 |
| 6 | C-05, C-06 JS-only and dev-tool cleanup | Zero bundle bytes; install, audit, and clarity | Low | Very low | D-9 (TypeScript version) | 1 |
| 7 | C-08b drop MaterialIcons (map tab icons to MCI) | 356,840 B | Low | Medium (visual on Android tab bar) | D-4b | 2 (optional) |
| 8 | C-10 blurhash placeholder | 5,075 B; brand fix | Low | Low | D-5 | 2 (optional) |
| 9 | X-3 iOS AVIF decoder removal | NOT MEASURED (libdav1d is large) | Low config | Medium (format support) | D-6 | 6 (experiment) |
| 10 | X-1 stub @expo/ui on Android | 966,544 B + 66,571 B JS + Compose native | Medium | High (patches router internals) | Not recommended now | Deferred |
| — | Icon glyph subsetting | up to ≈ 1.2 MB | High, recurring | High (maintenance) | Rejected (DL-06) | — |
| — | Replace expo-router / Reanimated / expo-image | Large | Very high | Very high; violates constraints | Rejected | — |
