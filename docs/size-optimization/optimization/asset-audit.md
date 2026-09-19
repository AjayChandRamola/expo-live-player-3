# Asset Audit — 2026-09-19

Two populations are audited separately: (A) files under `assets/` and other binary files tracked in git, and (B) assets that actually reach the production bundle (from `expo export` `metadata.json`). Only population B affects app size. Population A affects repository size, prebuild inputs, and maintainability.

Static application assets versus remote content: the app bundles no video, no thumbnails, and no user content. All media comes from `services/` (demo provider or the API configured in `app.json` `extra`). This is correct and must stay so.

## A. Repository assets

| File | Bytes | Dimensions / format | Required? | Compress? | Convert? | Remote instead? | Disposition |
|---|---|---|---|---|---|---|---|
| `assets/images/icon.png` | 393,493 | 1024×1024, PNG RGB (no alpha) | Yes: prebuild source for iOS icon and Android legacy icon | Losslessly, yes (an RGB 1024² photo-like PNG at 393 KB suggests no palette optimisation). Does **not** change app size: prebuild re-encodes to platform sizes | No | No | Optional lossless `oxipng -o 4` for repo hygiene; verify identical pixels (`compare` or Node `pngjs` diff) |
| `assets/images/android-icon-foreground.png` | 78,796 | 512×512 RGBA | Yes: adaptive icon layer | Lossless possible | No | No | Optional lossless optimisation; no app-size effect |
| `assets/images/android-icon-background.png` | 17,549 | 512×512 RGBA | Yes | — | Could be replaced by `backgroundColor` only if it is a flat colour; not verified | No | Leave |
| `assets/images/android-icon-monochrome.png` | 4,140 | 432×432 RGBA | Yes (Android 13 themed icon) | — | — | — | Leave |
| `assets/images/splash-icon.png` | 17,547 | 1024×1024 indexed | Yes: expo-splash-screen plugin input | Already palette PNG | — | — | Leave |
| `assets/images/favicon.png` | 1,129 | 48×48 | Web only | — | — | — | Leave |
| `assets/images/partial-react-logo.png` | 5,075 | 518×316 indexed | **Bundled**: placeholder in `VideoCard.tsx:147` and `UpNextList.tsx:83` (`placeholder={require(...)}`) | Could shrink, but better removed | Replace with an `expo-image` `placeholder={{ blurhash }}` constant (a short string; zero asset bytes) or a solid `backgroundColor` | — | Replace (C-10), pending D-5 because it changes the placeholder look (today it shows the React logo, which is not Yagna branding) |
| `assets/images/react-logo.png`, `@2x`, `@3x` | 6,341 / 14,225 / 21,252 | 100/200/300 px RGBA | No: not imported anywhere (template leftovers) | — | — | — | Delete (C-07, pending D-7). Zero app-size effect |
| `assets/icons/shorts-active.svg`, `shorts-inactive.svg` | 977 / 976 | 512 viewBox; rect + one path; fixed colours (#FF0000 + #FFFFFF; #9E9E9E + #E6E6E6) | Yes: Shorts tab icon (`app/(tabs)/_layout.tsx`) | — | Rasterise to PNG at 28/56/84 px (`tokens.iconSize.lg` = 28) so `react-native-svg` can be dropped (C-09). Colours are fixed, not tinted, so a raster keeps the same look | — | Convert (C-09) pending D-4 visual sign-off |
| `assets/button-export-tool.html`, `assets/youtube-controls-export-complete.html` | 14,394 / 13,924 | HTML | No: design-tool exports; `.html` is not in Metro `assetExts`, so never bundled | — | — | — | Move to `docs/history/` or delete (D-7) |
| `VIDEO_FEED_IMPLEMENTATION_GUIDE.zip` (root) | 320,405 | zip | No: tracked artefact; its Markdown twin exists at `docs/history/delivery-notes/VIDEO_FEED_IMPLEMENTATION_GUIDE.md` | — | — | — | Delete from git (D-7) |

Fonts: no custom fonts are loaded (`grep useFonts|loadAsync|expo-font` over source returns nothing). The three `@expo-google-fonts/*` packages are installed but unreferenced and contribute zero bundle bytes; they are removed in C-05.

## B. Bundle assets (Android export, 47 files, 5,071,209 B)

| Bytes | Count | Asset | Required? | Optimisation | Quality implication |
|---|---|---|---|---|---|
| 1,307,660 | 1 | `MaterialCommunityIcons.ttf` | Yes (51 icon uses across 18 files) | Keep. Glyph subsetting is possible in principle (`pyftsubset` to the ~40 glyph names used) but requires a custom `createIconSet` with a generated glyph map and re-subsetting on every icon change; rejected as not maintainable (see decision log DL-06) | None if kept |
| 356,840 | 1 | `MaterialIcons.ttf` | Yes (Android/web fallback for the tab icons in `icon-symbol.tsx`: `home`, `live-tv`, `bookmark`, `search`, `settings`, and 3 unused mappings) | Alternative: map the tab icons to `MaterialCommunityIcons` equivalents (`home`, `television-classic`/`access-point`, `bookmark`) and drop `MaterialIcons` entirely (−356,840 B). Changes glyph shapes on Android tab bar; iOS unaffected (SF Symbols) | Visual change on Android tab bar; offered as optional C-08b pending D-4b |
| 2,412,340 | 17 | AntDesign, Entypo, EvilIcons, Feather, FontAwesome, FontAwesome5 (3), FontAwesome6 (3), Fontisto, Foundation, Ionicons, Octicons, SimpleLineIcons, Zocial | **No** — no icon from any of these families is used | Import families by deep path (`@expo/vector-icons/MaterialCommunityIcons`) instead of the barrel (C-08) | None |
| 966,544 | 1 (Android only) | `MaterialSymbols_400Regular.ttf` from `@expo-google-fonts/material-symbols` | No — pulled by `@expo/ui` through expo-router's Android toolbar | Not removable without patching or stubbing expo-router internals (experiment X-1, off by default) | — |
| 27,825 | 27 | expo-router internal PNG/XML (largest `arrow_down.png` 9,456, `unmatched.png` 4,752) and `partial-react-logo.png` 5,075 | Router assets yes; placeholder replaceable | C-10 removes 5,075 B | See D-5 |

APK packaging note: Android's `aapt2` does not compress `.ttf` (it is on the default no-compress list), so font bytes in the AAB/APK are close to raw; Play's download compression reduces the transfer size but the on-device footprint remains near raw. iOS packages assets uncompressed in the app bundle; App Store delivery compresses. Therefore the 2,412,340 B removal in C-08 is expected to translate almost one-to-one into installed size on both platforms. This must still be confirmed by measuring the AAB and IPA (Phase 9).

## C. Assets generated at build time (not in the repository)

| Artefact | Generated by | Size driver | Optimisation |
|---|---|---|---|
| Android `mipmap-*` launcher icons, adaptive icon XML | `expo prebuild` from `icon.png` and `android.adaptiveIcon` | Fixed by Android densities | None needed; `enablePngCrunchInReleaseBuilds` (default true) already optimises |
| Android splash drawables | expo-splash-screen plugin from `splash-icon.png` at `imageWidth: 200` | Small | None |
| iOS `AppIcon.appiconset`, `SplashScreen` storyboard assets | prebuild | Fixed | None |
| `index.android.bundle` / `main.jsbundle` (Hermes) | Metro + Hermes at build | 4.94 MB / 4.75 MB today | See `bundle-optimization.md` |
| Native `.so` / frameworks | Gradle / CocoaPods | media3, Glide/AVIF, Compose (via @expo/ui), Reanimated/Worklets, Hermes, RN core | See `android-optimization.md` |

## D. Summary of asset dispositions

| Change | Bundle bytes removed (raw) | Files removed | Certainty |
|---|---|---|---|
| C-08 deep icon imports | 2,412,340 per platform | 17 | High: mechanism verified in `IconsLazy.js` and export log; exact result to be confirmed by export after change |
| C-08b (optional) drop MaterialIcons | 356,840 | 1 | High mechanically; requires visual approval |
| C-09 raster Shorts tab icon | 0 bytes of assets added ≈ 3 small PNGs (estimated under 6 KB total, to be measured); removes 104,413 B unminified JS and a native library | — | Medium: JS figure measured; native figure NOT MEASURED |
| C-10 blurhash placeholder | 5,075 | 1 | High |
| Repository hygiene (D-7) | 0 | 0 | Repository only |
