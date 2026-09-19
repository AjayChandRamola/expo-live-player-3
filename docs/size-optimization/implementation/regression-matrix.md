# Functional Regression Matrix

Derived from the actual routes, components, hooks, and the player feature catalogue (F1–F38). "Verification" names the automated suite that covers the row today and the manual step on an emulator release build (Phase 8). "Release" in the manual column means the row must be re-run on the R8-enabled build (C-14). Risk is the risk that this initiative's changes affect the row.

| # | Feature | Existing behaviour (source) | Must preserve? | Verification (automated / manual) | Risk from this initiative |
|---|---|---|---|---|---|
| 1 | App launch | `app/_layout.tsx` providers, theme, deep-link effect | Yes | `__tests__/harness/smoke.test.tsx` / launch on emulator, release | Low (C-04 removes modules; C-14 R8) |
| 2 | Home screen | `app/(tabs)/index.tsx`: featured card, live banner, latest feed, pull-to-refresh, state view | Yes | `screens/HomeScreen.test.tsx`, `pullToRefresh.test.tsx` / scroll, refresh, tap video | Low (C-10 placeholder) |
| 3 | Tab navigation | `app/(tabs)/_layout.tsx`: Home, Live, Shorts, Saved with icons and haptic tab | Yes | `navigation/tabLayout.test.tsx` / switch tabs, check icons at focused/unfocused | **Medium** (C-08b optional glyphs, C-09 Shorts icon) |
| 4 | Stack navigation and headers | Video, Search, Settings screens | Yes | screen tests / navigate and back | Low |
| 5 | Deep links | `services/deepLinkService.ts`; scheme `expoliveplayer` | Yes | `services/deepLinkService.test.ts` / `adb shell am start -d expoliveplayer://video/<id>` release | Low |
| 6 | Video listing and thumbnails | `VideoFeed/VideoCard.tsx` with expo-image, placeholder | Yes | `screens/HomeScreen.test.tsx` / thumbnails load; placeholder shows before load | Low–medium (C-10) |
| 7 | Video screen | `app/video/[id].tsx`: container, meta, up-next, queue param sync | Yes | `screens/VideoScreen.test.tsx`, `components/VideoPlaybackContainer.test.tsx` / open video | Low |
| 8 | MP4 playback | Engine + expo-video (F1) | Yes | `player/engine/*`, `player/VideoPlayer.root.test.tsx` / demo MP4 plays, release | Medium (C-14) |
| 9 | HLS playback | Engine (F1); media3-exoplayer-hls | Yes | same / demo HLS plays, release | **Medium** (C-14 keep rules) |
| 10 | Live video (native live UI) | F20: live badge, go-live | Yes | `player/ui/controls.test.tsx` / live source on emulator if available | Low |
| 11 | Live fallback (YouTube WebView) | `LiveEmbedView.tsx`, allow-list | Yes | `components/LiveEmbedView.test.tsx` / Live tab with fallback, release | Medium (C-14; WebView keep rules) |
| 12 | Play/pause | F4 | Yes | `player/ui/PlayPauseButton.test.tsx` / tap | Low |
| 13 | Seek (scrub, tap, double-tap skip) | F5 | Yes | `player/ui/ProgressBar.test.tsx`, `player/gestures/useTapGestures.test.tsx` / scrub and double-tap | Low |
| 14 | Mute/unmute, volume | F6 | Yes | `player/ui/controls.test.tsx` / tap mute | Low |
| 15 | Fullscreen and orientation | F9, `platform/orientation.native.ts`, `fullscreen.native.ts` | Yes | `player/hooks/useFullscreen.test.tsx`, `platform/*.test.ts` / enter, rotate, exit, release | Low |
| 16 | Loading and buffering indicator | F7 | Yes | `player/ui/transient.test.tsx` / throttle network on emulator | Low |
| 17 | Error handling and retry | F8, `classifyError.ts`, `retryPolicy.ts` | Yes | `player/engine/classifyError.test.ts`, `retryPolicy.test.ts`, `player/ui/ErrorCard.test.tsx` / bad URL shows card, retry works | Low (ErrorCard import path changes in C-08) |
| 18 | Captions | F18 | Yes | `player/pure/selectCue.test.ts`, `player/ui/SettingsSheet.test.tsx` / select track | Low |
| 19 | Chapters | F19 | Yes | `player/pure/currentChapter.test.ts` / chapter label | Low |
| 20 | Playback rate | F17 | Yes | `player/ui/SettingsSheet.test.tsx` / change rate | Low |
| 21 | Looping / end screen / autoplay next | F12 | Yes | `player/ui/EndScreen.test.tsx`, `contexts/PlayQueueContext.test.tsx` / let video end | Low |
| 22 | Picture-in-picture (flag off; adapter present) | F21, `PLAYER_FEATURE_FLAGS.pictureInPicture=false` | Yes (current behaviour: button hidden) | `platform/pictureInPicture.*.test.ts` / confirm button absent | Low |
| 23 | Auto-hide controls | F11 | Yes | `player/gestures/useControlsVisibility.test.tsx` / wait 3 s | Low |
| 24 | Brightness/volume swipe | F23 | Yes | `player/gestures/useSwipeGestures.test.tsx`, `platform/brightness.native.test.ts` / swipe | Low |
| 25 | Mini-player / minimize | F25 | Yes | `player/ui/MiniPlayer.test.tsx` / minimize and restore | Low |
| 26 | Keep screen awake while playing | F22 via `keepScreenOnWhilePlaying` | Yes | `player/engine/PlaybackEngine.test.ts` / screen stays on during playback (emulator timeout set to 30 s) | Low |
| 27 | Haptics | F26 | Yes | `platform/haptics.native.test.ts` / — | Low |
| 28 | Toast | F27 | Yes | `player/ui/transient.test.tsx` / — | Low |
| 29 | Like/dislike | F30, `useVideoActions`, local repository | Yes | `components/actions/useVideoActions.test.tsx`, `VideoActionBar.test.tsx` / tap, relaunch, state persists | Low |
| 30 | Save (and Saved tab, undo) | F31, `SavedContext`, `saved.tsx` | Yes | `contexts/SavedContext.test.tsx`, `screens/SavedScreen.test.tsx` / save, open Saved, unsave with undo | Low |
| 31 | Share | F32, `shareLinkService` | Yes | `components/actions/ShareSheet.test.tsx` / share sheet opens | Low |
| 32 | Download (flag off) | F33, `downloadService`, MP4-only rule | Yes (current: hidden) | `services/videoActions/downloadService.test.ts`, `DownloadSheet.test.tsx` / confirm hidden | Low |
| 33 | Clip editor | F34 | Yes | `ClipEditor.test.tsx` / open, adjust, save metadata | Low (import path) |
| 34 | Report / not interested / overflow menu | F35 | Yes | `ReportSheet.test.tsx`, `OverflowMenu.test.tsx` / open and submit | Low (import path) |
| 35 | Thanks (flag off) | F36, unavailable provider | Yes (hidden) | `ThanksSheet.test.tsx`, `unavailablePaymentProvider.test.ts` / confirm hidden | Low |
| 36 | Title handling and meta | `VideoMeta.tsx`, `titleMaxLength` | Yes | `components/VideoMeta.test.tsx` / long title | Low |
| 37 | Search (query, debounce, recents, results) | `app/search.tsx`, `useSearch` | Yes | `screens/SearchScreen.test.tsx`, `hooks/useSearch.test.tsx` / type, submit, recents | Low (SearchInput import path) |
| 38 | Settings (theme, autoplay) | `app/settings.tsx`, `SettingsContext` | Yes | `screens/SettingsScreen.test.tsx`, `contexts/SettingsContext.test.tsx` / toggle, relaunch | Low |
| 39 | Offline banner / online detection | `useIsOnline`, `OfflineBanner` | Yes | `hooks/useIsOnline.test.tsx` / airplane mode on emulator | Low |
| 40 | Shorts feed, swipe, mute, progress, actions | `app/(tabs)/shorts.tsx`, `components/Shorts/*` | Yes | `__tests__/Shorts.test.tsx` / swipe, double-tap, mute | Low–medium (C-08 import lines in 4 files; C-11 removes their console logs) |
| 41 | Shorts search and voice-search alert | `ShortsSearchBar.tsx`, `useVoiceSearch.ts` (native path shows an Alert) | Yes (current behaviour) | `Shorts.test.tsx` / search and tap mic → alert | Low (C-07 removes only the unused import) |
| 42 | Comments (Shorts) | `Comments/*` via `ShortCard` | Yes | `__tests__/Comments.test.tsx` / open comments, post, reply | Low (import path; console stripping) |
| 43 | Logging / observability | `Logger.error/warn` in production; `installGlobalErrorHandlers` in dev; analytics dev-only | Yes: `error` and `warn` must survive | `__tests__/Logger.test.ts` (update for `__DEV__` gating), `babelProduction.test.ts` / production export contains `console.error` sites | Medium (C-11 by design removes `log/info/debug`) |
| 44 | Web target | platform `.web.ts` adapters, `expo export --platform web` | Yes (D-8) | `npm run test:web` / `npx expo export --platform web` succeeds | Low (C-09 PNG on web) |
| 45 | Existing routes | `(tabs)/index, live, shorts, saved`, `video/[id]`, `search`, `settings` | Yes | typed routes (`.expo/types`) compile / navigate to each | Low |
| 46 | Permissions and manifest | derived from modules | Must not gain; may lose unused | `aapt2 dump badging` diff (Phase 9) | Low (improves) |

Rows 8, 9, 11, 15 are the mandatory release-build rows for accepting C-14.
