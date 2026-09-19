# Video Architecture as It Relates to Size

Source of truth: `docs/player/03-architecture.md`, `docs/player/02-feature-catalog.md` (F1–F38), ADRs 0001–0012, and the code under `components/VideoPlayer/`, `components/Video/`, `components/Shorts/`, `contexts/PlayQueueContext.tsx`. This document records what exists (verified from source on 2026-09-19), what it costs, and what this initiative may and may not touch.

## 1. Current player architecture (verified)

| Layer | Files | Third-party imports | Size relevance |
|---|---|---|---|
| Public API | `components/VideoPlayer/index.tsx` (re-export), `Player.tsx` (composition root), `types.ts`, `constants.ts`, `tokens.ts` | react, react-native, gesture-handler, safe-area-context, `expo-video` (type only in `Player.tsx`) | 79,119 B unminified first-party |
| Engine | `engine/PlaybackEngine.ts`, `playbackReducer.ts`, `usePlaybackEngine.ts`, `classifyError.ts`, `retryPolicy.ts`, `initialSnapshot.ts`, `devLog.ts`, `pure/*` | `expo-video` (`createVideoPlayer`), sets `keepScreenOnWhilePlaying = true`, `staysActiveInBackground = false`, `timeUpdateEventInterval` | Owns the one `VideoPlayer` instance; no size levers |
| Platform adapters | `platform/*.native.ts` / `*.web.ts` | `expo-brightness`, `expo-haptics`, `expo-screen-orientation`, RN `StatusBar`, `Platform` (only allowed here, R4) | Three small native modules, all required (F23, F26, F9) |
| Gestures | `gestures/useTapGestures.ts`, `useSwipeGestures.ts`, `useControlsVisibility.ts` | gesture-handler, reanimated | Required |
| UI | `ui/PlayerSurface.tsx` (`VideoView` from expo-video, `Image` from expo-image for poster), `ControlsOverlay`, `ProgressBar`, `CaptionsView`, `BufferingIndicator`, `ErrorCard`, `EndScreen`, `MiniPlayer`, `SettingsSheet`, `SwipeIndicator`, `Toast`, `controls/*` | reanimated; `@expo/vector-icons` barrel in `controls/ControlButton.tsx`, `ErrorCard.tsx`, `SwipeIndicator.tsx` | The three barrel imports are part of C-08 |
| Container | `components/Video/VideoPlaybackContainer.tsx` | none beyond player and services | Only importer of the player (R1) |
| App actions | `components/Video/actions/*`, `services/videoActions/*` | `@expo/vector-icons` barrel in `VideoActionButton.tsx`, sheets `ClipEditor`, `OverflowMenu`, `SaveSheet`; `expo-file-system/legacy` in `downloadService.ts` | Barrel imports in C-08 |
| Queue | `contexts/PlayQueueContext.tsx` | react | — |

Feature flags (`constants/config.ts` `PLAYER_FEATURE_FLAGS`): download false, pictureInPicture false, qualitySelection false, clipEditor true, thanks false, report true, dislike true. These are unchanged by this initiative.

## 2. Capability inventory (from F1–F38 and source; used by the regression matrix)

MP4 and HLS playback (VOD and live) · explicit state machine · event-driven progress and buffered range · play/pause/toggle · seek by scrub, tap, double-tap skip, keyboard (web) · mute and volume · buffering indicator · error card with retry and error classification · in-place fullscreen with orientation lock/unlock · lifecycle (unmount, background, source change) · controls visibility with auto-hide · next/previous, autoplay-next toggle, end screen countdown · safe areas and layout modes · accessibility labels · resume position reporting via `onPositionChange` · poster before first frame (expo-image) · playback speed · captions · chapters · live UI (badge, go-live) · picture-in-picture adapter (flag off) · keep screen awake while playing (via player property, no expo-keep-awake) · brightness and volume swipe · quality display · mini-player · haptics · toast · web keyboard and hover · action bar outside the player: like/dislike, save, share, download (MP4 only, flag off), clip editor (metadata), report/not interested, thanks (flag off), feature flags, analytics (dev-only sink).

## 3. Native media stack (verified from `node_modules`)

Android (`expo-video/android/build.gradle`): `androidx.media3` `exoplayer`, `exoplayer-hls`, `exoplayer-dash`, `session`, `ui`, `datasource-okhttp`, plus `androidx.fragment`. The app uses HLS and progressive MP4; DASH and `media3-ui` are not exercised but are hard dependencies of expo-video. With R8 enabled (C-14), unreachable DASH and UI classes are candidates for removal by the shrinker; the size effect is NOT MEASURED and must be observed rather than assumed.

iOS (`ExpoVideo.podspec`): depends only on `ExpoModulesCore`; playback is AVFoundation (system framework, zero app bytes).

Images: `expo-image` brings Glide + AVIF + androidsvg + animated-image plugin on Android and SDWebImage + AVIF (libdav1d) + SVG + WebP coders on iOS. Used for four call sites (three thumbnails, one poster). The poster path is inside the protected player (`PlayerSurface.tsx`).

Live fallback: `components/Live/LiveEmbedView.tsx` renders a YouTube embed through `react-native-webview` with an allow-list from `constants/config.ts` `YOUTUBE_EMBED`. Required while `extra.liveSourceFallback` is `"youtube"`.

Shorts: `components/Shorts/ShortVideoPlayer.tsx` and `hooks/useShortsPlayer.ts` use `expo-video` directly (`useVideoPlayer`, `VideoView`) and are a separate experience (ADR 0011, R7).

## 4. Size opportunities that do not degrade video (adopted)

| Opportunity | Effect on video | Adopted as |
|---|---|---|
| Remove expo-audio | None. expo-video owns the audio session; expo-audio was never imported | C-04 |
| Deep icon imports in three player UI files and four action files | None. Same component object; only the module path changes | C-08 |
| Strip `console.log` in production | None. `devLog.ts` is already `__DEV__`-gated; engine has no console calls | C-11 |
| R8 shrinking | None expected; must be verified by playback regression on emulator (MP4, HLS, live fallback, seek, background/foreground, rotate) | C-14 |

## 5. Opportunities considered and rejected for video reasons

| Idea | Why rejected |
|---|---|
| Replace expo-video with a lighter player | Violates CLAUDE.md §6 and the protected-module rule; expo-video is the SDK-supported player with HLS, PiP, captions, and background support |
| Replace expo-image with RN `Image` | Loses disk/memory caching, transitions, and the poster behaviour the player depends on; native saving is NOT MEASURED; feed scroll performance risk |
| Drop `expo-brightness`, `expo-screen-orientation`, `expo-haptics` | Each backs an accepted feature (F23, F9, F26) |
| Move Shorts onto the engine to share code | Explicitly out of scope (ADR 0011); no size case, since both already share expo-video |
| Disable AVIF on Android | expo-image has no switch on Android (Glide avif-integration is a hard dependency); only iOS has the Podfile property (X-3) |

## 6. Invariants this initiative must keep green

R1 (only the container imports the player), R2 (player imports no app code), R3 (only engine and PlayerSurface import expo-video), R4 (`Platform` only under `platform/`), R5 (no legacy Animated, no react-native-paper), R6 (no `any`), R7 (Shorts unchanged from `main` — see D-3 for the import-path exception and its handling), R9 (file budgets and timer confinement). `__tests__/player/invariants.test.ts` must pass after every task.
