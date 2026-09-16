# 02 — Feature Catalog

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 5 |
| Constants | Every timing or threshold named here is defined in `components/VideoPlayer/constants.ts` (player) or `constants/config.ts` (app). The name in backticks is the constant to use. Never write the number in a component. |
| States | Every feature lists the states it must render or handle. If a state does not apply, the row says "n/a" with the reason. |

## Legend

- **Tier 1** core playback, **Tier 2** complete experience, **Tier 3** app actions (outside the player).
- **Owner** is the file that implements the behaviour. **Consumer** is who calls it.
- **Increment** is where it is built (see `10-migration-and-swap.md`).
- **Tests** name the test file that proves the feature. Acceptance criteria are written so each line maps to at least one test.

---

## Tier 1 — Core

### F1 MP4 and HLS playback, VOD and live

- **User goal:** Watch any Yagna video or live stream the app hands to the player.
- **Owner:** `engine/PlaybackEngine.ts` (`setSource`), `ui/PlayerSurface.tsx`.
- **Preconditions:** `source.url` is `https://` or `file://`, already validated by `services/mediaSourceResolver.ts`. `source.kind` is `"hls"` or `"mp4"`. `source.isLive` is what the backend declared.
- **Flow:** Container passes `source` → hook calls `engine.setSource` → engine calls `player.replace({ uri, headers, contentType: kind === "hls" ? "hls" : "auto" })` → `statusChange loading` → `statusChange readyToPlay` → `ready` → autoplay calls `play()` → `playing`.
- **States:** loading (poster + spinner), ready (poster + play button when autoplay is false), playing, error (see F8). Empty: n/a, the container never renders the player without a source. Offline: engine error `network` (F8).
- **Acceptance:**
  1. An MP4 source reaches `playing` and `durationMs > 0`.
  2. An HLS VOD source reaches `playing` and `durationMs > 0`.
  3. An HLS live source reaches `playing`, `isLive === true`, `durationMs === 0` or the live window length.
  4. `headers` are passed to expo-video and never appear in any log line (test spies on `Logger`).
  5. A `file://` MP4 plays (downloaded video, F33).
- **Constants:** none.
- **Increment:** 1 (engine), 4 (surface).
- **Tests:** `__tests__/player/engine/PlaybackEngine.test.ts` ("setSource"), `__tests__/player/VideoPlayer.root.test.tsx`.

### F2 Explicit state machine

- **Owner:** `engine/playbackReducer.ts`.
- **Acceptance:** every cell in spec table 4.2 has a named test; ignored pairs return the same object reference; invariants (position bounds, error iff status error, retry bound) hold after every transition in a property-style loop over all events from all states.
- **Increment:** 1.
- **Tests:** `__tests__/player/engine/playbackReducer.test.ts`.

### F3 Event-driven progress and buffered range

- **Owner:** `engine/PlaybackEngine.ts` (event handlers).
- **Acceptance:**
  1. `positionMs` updates only from `timeUpdate` (`currentTime * 1000`), never from a timer.
  2. `bufferedMs === Math.round(payload.bufferedPosition * 1000)`; when native reports `-1` (unknown) the engine stores `0`.
  3. `player.timeUpdateEventInterval` is set to `TIME_UPDATE_INTERVAL_MS / 1000` (0.25).
  4. No `setInterval` exists under `components/VideoPlayer/` (invariant grep in `09-test-plan.md`).
- **Constants:** `TIME_UPDATE_INTERVAL_MS = 250`.
- **Increment:** 1.

### F4 Play, pause, toggle

- **Owner:** `ui/controls/PlayPauseButton.tsx` (view), `engine` commands.
- **States:** `playing` shows pause icon and label "Pause"; `paused`/`ready` show play icon and "Play"; `ended` shows replay icon and "Replay" (calls `replay`); `loading`/`buffering` show the spinner in the same slot (F7); `error` shows nothing here (F8 takes the slot).
- **Acceptance:**
  1. Pressing in `playing` calls `commands.pause()` exactly once.
  2. Pressing in `paused` calls `commands.play()`.
  3. Pressing in `ended` calls `commands.replay()`.
  4. Twenty rapid presses result in twenty command calls in order (no debounce on the button; the engine is idempotent).
  5. Accessibility label reflects state.
- **Increment:** 3.
- **Tests:** `__tests__/player/ui/PlayPauseButton.test.tsx`.

### F5 Seek: scrub, tap, double-tap skip, keyboard

- **Owner:** `ui/ProgressBar.tsx`, `gestures/useTapGestures.ts`, `platform/keyboard.web.ts`, engine `seekTo`/`seekBy`.
- **Flow (scrub):** pan begins → `onSeekStart` (visibility timer paused, preview label shown) → `onSeekPreview(ms)` on each move → `onSeekCommit(ms)` on release → `commands.seekTo(ms)` → `positionMs` updates on the next `timeUpdate`. During the drag the bar shows the preview position, not the live position.
- **Flow (double tap):** see F-gestures in `06-ui-and-gestures-spec.md`; calls `seekBy(±SKIP_MS)`.
- **Acceptance:**
  1. `seekTo` clamps to `[0, durationMs]` for VOD.
  2. For live with a seekable window, clamps to `[edge - liveWindowMs, edge]`; with no window the bar is disabled and `seekTo` is a dev-warned no-op.
  3. `seekBy(+10 s)` at 5 s before the end seeks to `durationMs`, does not trigger `ended` by itself.
  4. Ten `seekTo` calls within 1 s result in the last position being applied; no error state.
  5. Rotating the device during a drag cancels the drag without committing (S14).
  6. Web: ArrowLeft/Right seek 5 s, J/L 10 s, digits 0–9 seek to that tenth of the duration (VOD only).
- **Constants:** `SKIP_MS = 10_000`, `KEYBOARD_SEEK_SMALL_MS = 5_000`, `KEYBOARD_SEEK_LARGE_MS = 10_000`.
- **Increment:** 1 (engine), 3 (UI and gestures), 2 (keyboard).
- **Tests:** `__tests__/player/engine/PlaybackEngine.test.ts` ("seek"), `__tests__/player/ui/ProgressBar.test.tsx`, `__tests__/player/gestures/useTapGestures.test.tsx`, `__tests__/player/platform/keyboard.web.test.ts`.

### F6 Mute and volume

- **Owner:** `ui/controls/MuteButton.tsx`, `gestures/useSwipeGestures.ts`, engine `setMuted`/`setVolume`.
- **Acceptance:**
  1. Mute button toggles `player.muted`; icon and label ("Mute"/"Unmute") follow `snapshot.muted`.
  2. `setVolume` clamps to `[0, 1]`; setting volume above 0 while muted unmutes.
  3. Volume swipe on the right half changes volume by `-translationY / surfaceHeight` from the value at gesture start.
  4. Web: M toggles mute.
- **Increment:** 1, 3.

### F7 Buffering indicator

- **Owner:** `ui/BufferingIndicator.tsx`.
- **Acceptance:** visible only when `status` is `loading` or `buffering`; sits in the centre play slot; `accessibilityLabel="Loading"`; not pressable; fades in after `BUFFERING_INDICATOR_DELAY_MS` so a 100 ms stall does not flash it.
- **Constants:** `BUFFERING_INDICATOR_DELAY_MS = 300`.
- **Increment:** 3.
- **Tests:** `__tests__/player/ui/BufferingIndicator.test.tsx`.

### F8 Error card with retry

- **Owner:** `ui/ErrorCard.tsx`, engine E6, `engine/retryPolicy.ts`, `engine/classifyError.ts`.
- **States:**
  - Automatic retry in progress: card shows `error.message` and "Retrying (n/3)…" with a spinner, no button.
  - Retries exhausted and `retryable`: card shows message and a "Retry" button → `commands.retry()`.
  - `retryable === false` (unsupported): card shows message and no button.
  - Offline (network error): same as retryable; the container may additionally show the app's offline banner from `onStateChange`.
- **Acceptance:**
  1. Native error with message containing "403" → code `expired`, message `ERROR_MESSAGES.expired`.
  2. Retry delays are 1 s, 2 s, 4 s; the fourth failure leaves `error` with the button.
  3. Manual Retry resets `retryAttempt` to 0 and re-runs the source at the last known position.
  4. A `setSource` during a pending retry cancels the timer (no `replace` after the new source).
  5. Card copy never contains the URL or the raw native message.
  6. Load timeout: `loading` for `LOAD_TIMEOUT_MS` with no `readyToPlay` → synthetic `network` error.
- **Constants:** `RETRY_DELAYS_MS = [1_000, 2_000, 4_000]`, `LOAD_TIMEOUT_MS = 15_000`, `ERROR_MESSAGES` (network: "Connection problem. Check your network and try again."; unsupported: "This video format can't be played on this device."; expired: "This video link has expired. Please reopen the video."; decode: "Playback problem. Try again."; unknown: "Something went wrong. Try again.").
- **Increment:** 1 (engine), 3 (card).
- **Tests:** `__tests__/player/engine/retryPolicy.test.ts`, `classifyError.test.ts`, `PlaybackEngine.test.ts` ("retry"), `__tests__/player/ui/ErrorCard.test.tsx`.

### F9 Fullscreen and orientation, in place

- **Owner:** `Player.tsx` layout mode, `platform/fullscreen.*`, `platform/orientation.*`, `platform/systemChrome.*`.
- **Flow (enter, native):** button or landscape rotation with `FULLSCREEN_ON_ROTATE` true → `fullscreen.enter()` → `orientation.lock("landscape")` → `systemChrome.hide()` → layout mode `fullscreen` → `onFullscreenChange(true)`. Exit reverses and locks `portrait` (the app is portrait-locked; see `app.json`).
- **Flow (web):** `fullscreen.enter()` → `container.requestFullscreen()`; `fullscreenchange` drives the flag so the browser's own Escape works.
- **Acceptance:**
  1. The `VideoView` node identity is unchanged across enter and exit.
  2. `positionMs` before enter equals `positionMs` after (within one `timeUpdate`).
  3. Playing state is unchanged across the transition.
  4. Android back button in fullscreen exits fullscreen and is consumed (does not navigate back).
  5. A failed orientation lock still enters fullscreen and logs one warning.
  6. Unmount while fullscreen restores orientation and chrome.
  7. Web: Escape exits; F toggles.
- **Constants:** `FULLSCREEN_ON_ROTATE = true` (auto-enter when the device rotates to landscape while inline and the orientation adapter reports it; exit on rotate back is not automatic because the user may have entered via button).
- **Increment:** 2 (adapters), 4 (root).
- **Tests:** `__tests__/player/platform/fullscreen.*.test.ts`, `orientation.*.test.ts`, `__tests__/player/VideoPlayer.root.test.tsx` ("fullscreen").

### F10 Lifecycle

- **Owner:** `engine/usePlaybackEngine.ts`, engine E1, E3, E8.
- **Acceptance:**
  1. `AppState` → `background` while playing: `player.pause()` called once; status `paused`; `isPlayingBeforeBackground` true.
  2. `AppState` → `active`: status stays `paused`; controls visible.
  3. Unmount: every subscription removed, timers cleared, `player.pause()` called, no state update after unmount.
  4. Same URL re-render: zero `replace` calls.
  5. URL change: exactly one `replace`, status `loading`, `onPositionChange` fired with the old position first.
  6. Brightness restored on unmount if changed.
- **Increment:** 1.
- **Tests:** `__tests__/player/engine/usePlaybackEngine.test.tsx`.

### F11 Controls visibility

- **Owner:** `gestures/useControlsVisibility.ts`.
- **Acceptance:** table in spec 6.3; plus: hidden overlay has `pointerEvents="none"`; visible overlay `box-none`; settings sheet open forces visible; the fade uses `CONTROLS_FADE_MS`.
- **Constants:** `INITIAL_VISIBLE_MS = 3_000`, `AUTO_HIDE_MS = 3_500`, `CONTROLS_FADE_MS = 200`.
- **Increment:** 3.
- **Tests:** `__tests__/player/gestures/useControlsVisibility.test.tsx` (fake timers).

### F12 Next, previous, autoplay-next toggle, end screen

- **Owner:** `ui/controls/SkipButton.tsx`, `ui/controls/AutoplayToggle.tsx`, `ui/EndScreen.tsx`, `ui/Toast.tsx`.
- **States:** SkipButton disabled (opacity from tokens, `accessibilityState.disabled`) when `hasNext`/`hasPrevious` is false. AutoplayToggle disabled when `hasNext` false. EndScreen: replay only (autoplay-next off or no next); replay + "Up next in 5" countdown + Cancel (autoplay-next on and hasNext).
- **Acceptance:**
  1. Next press calls `onNext`; previous calls `onPrevious`; disabled buttons call nothing.
  2. Toggle calls `onToggleAutoplayNext(!current)` and shows toast "Autoplay is on"/"Autoplay is off".
  3. On `ended` with autoplay-next on and `hasNext`, countdown from `END_SCREEN_COUNTDOWN_MS` then `onFinished` once; Cancel stops it and shows replay only.
  4. Leaving `ended` (replay or new source) cancels the countdown.
  5. Live streams never show the countdown.
- **Constants:** `END_SCREEN_COUNTDOWN_MS = 5_000`.
- **Increment:** 3, 4.
- **Tests:** `__tests__/player/ui/SkipButton.test.tsx`, `AutoplayToggle.test.tsx`, `EndScreen.test.tsx`.

### F13 Safe areas and layout modes

- **Owner:** `Player.tsx`, `ui/PlayerSurface.tsx`.
- **Acceptance:** spec 6.1 table; control padding adds `useSafeAreaInsets()` in fullscreen; inline height is `min(windowHeight * INLINE_MAX_HEIGHT_RATIO, windowWidth / ASPECT_16_9)`; `Dimensions` subscription removed on unmount (use `useWindowDimensions`).
- **Constants:** `ASPECT_16_9 = 16 / 9`, `INLINE_MAX_HEIGHT_RATIO = 0.304`, `MINI_PLAYER_WIDTH = 160`, `Z_INDEX_FULLSCREEN` (tokens).
- **Increment:** 4.

### F14 Accessibility

- **Owner:** every control; `ui/ProgressBar.tsx`; `ui/Toast.tsx`; `ui/ErrorCard.tsx`.
- **Acceptance:**
  1. Every pressable has `accessibilityRole="button"` and a non-empty label; toggles set `accessibilityState.selected`.
  2. Minimum 44×44 touch target via `hitSlop` on `sm` buttons.
  3. ProgressBar `accessibilityRole="adjustable"`, `accessibilityValue` with `text` "m:ss of m:ss", increment/decrement actions seek by `SKIP_MS`.
  4. Toast and ErrorCard have `accessibilityLiveRegion="polite"`.
  5. Captions font scales with `PixelRatio.getFontScale()`.
  6. Web: surface `role="application"`, visible focus ring on controls.
- **Increment:** 3.
- **Tests:** in each control's test file ("accessibility" describe block).

### F15 Resume position reporting

- **Owner:** `engine/usePlaybackEngine.ts` (cadence), `Player.tsx` (forwarding), engine E3 (apply `initialPositionMs`).
- **Acceptance:**
  1. `onPositionChange(positionMs, durationMs)` fires every `POSITION_REPORT_INTERVAL_MS` while `playing`.
  2. Fires on `paused`, after a committed seek, on `ended` (with `durationMs`), and on unmount (last known).
  3. Does not fire for live sources.
  4. `initialPositionMs` is applied once after the first `readyToPlay` and ignored if ≥ `durationMs - 1_000` (treat as finished, start at 0) or if live.
- **Constants:** `POSITION_REPORT_INTERVAL_MS = 5_000`, `RESUME_NEAR_END_GUARD_MS = 1_000`.
- **Increment:** 1, 4. Persisting the value is the app's job (later: `SettingsContext` or a `watchHistoryStorage`); this effort only reports it.

### F16 Poster before first frame

- **Owner:** `ui/PlayerSurface.tsx`.
- **Acceptance:** `posterUrl` rendered with `expo-image` (`contentFit="contain"`) while status is `idle`, `loading`, or `ready` before the first `playing`; hidden after; not rendered when `posterUrl` is undefined; `accessible={false}`.
- **Increment:** 4.

---

## Tier 2 — Complete experience

### F17 Playback speed

- **Owner:** `ui/SettingsSheet.tsx`, `gestures/useTapGestures.ts` (long press), engine `setRate`.
- **Acceptance:**
  1. Settings lists `PLAYBACK_RATES`; the active one is marked; selecting calls `setRate` and toasts "Speed 1.5×".
  2. Long press: `setRate(LONG_PRESS_RATE)` on begin, restore previous rate on end; toast "2× speed" while held.
  3. `setRate(3)` is rejected (dev warning) because 3 is not in the list.
  4. Rate persists across seek and buffering; resets to 1 on a new source.
- **Constants:** `PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]`, `LONG_PRESS_RATE = 2`, `LONG_PRESS_MS = 500`.
- **Increment:** 1, 3.

### F18 Captions

- **Owner:** `ui/CaptionsView.tsx`, `engine/pure/selectCue.ts`, engine `selectSubtitle`.
- **Two sources:**
  - (a) `captions` prop (`CaptionItem[]` sorted by `start`, seconds): `selectCue(captions, positionMs)` returns the cue with `start * 1000 <= positionMs < (end ?? nextStart) * 1000` via binary search; renders in `CaptionsView`.
  - (b) Embedded tracks: `snapshot.subtitleTracks` from `availableSubtitleTracksChange`; picking one calls `selectSubtitle(track)` → `player.subtitleTrack = track`; native renders them inside `VideoView`; `CaptionsView` is not used for (b).
- **States:** off (default when no `captions` prop and no track), on with prop cues, on with embedded track, empty (no cue at this position → view hidden), invalid cue (missing text → skipped).
- **Acceptance:**
  1. `selectCue` correct at boundaries (exactly `start`, exactly `end`, between cues, before first, after last).
  2. Toggle in settings persists for the mount only (the app may persist later).
  3. Captions option hidden when neither source exists.
  4. Font size = `CAPTION_FONT_SIZE * PixelRatio.getFontScale()`; background scrim from tokens; positioned above the bottom row and above the mini-player's controls.
- **Constants:** `CAPTION_FONT_SIZE = 16`.
- **Increment:** 1 (pure), 3 (view).

### F19 Chapters

- **Owner:** `ui/ProgressBar.tsx` (markers), `ui/TimeLabel.tsx` (title), `engine/pure/currentChapter.ts`.
- **Acceptance:**
  1. `currentChapter(chapters, positionMs)` returns the last chapter with `startMs <= positionMs`, or null before the first.
  2. Markers drawn at `startMs / durationMs` (skipped when `durationMs === 0`).
  3. Tapping a marker seeks to `startMs` (hit slop `CHAPTER_MARKER_HIT_SLOP`).
  4. Title shown beside the time label, truncated to one line.
- **Constants:** `CHAPTER_MARKER_HIT_SLOP = 8`.
- **Increment:** 1, 3.

### F20 Live UI

- **Owner:** `ui/controls/LiveBadge.tsx`, `ui/controls/GoLiveButton.tsx`, `ui/ProgressBar.tsx`, engine `goToLive`.
- **Acceptance:**
  1. Badge visible when `snapshot.isLive`; red dot from tokens; label "LIVE".
  2. "Go live" visible when `liveOffsetMs > LIVE_EDGE_TOLERANCE_MS`; pressing calls `goToLive` → `targetOffsetFromLive = 0` and seek to the edge.
  3. Progress bar hidden when the live window is 0; shows window otherwise with the thumb at the edge when live.
  4. Time label shows "LIVE" or "-0:35" (behind live) instead of duration.
  5. `initialPositionMs` and `onPositionChange` ignored for live.
- **Constants:** `LIVE_EDGE_TOLERANCE_MS = 10_000`.
- **Increment:** 1, 3.

### F21 Picture-in-picture

- **Owner:** `platform/pictureInPicture.*`, `ui/controls/PipButton.tsx`, `ui/PlayerSurface.tsx` (`allowsPictureInPicture`, `startsPictureInPictureAutomatically`, `onPictureInPictureStart/Stop`).
- **Acceptance:**
  1. Button hidden when `adapter.isSupported()` is false.
  2. Press → `adapter.start(viewRef)`; `onPictureInPictureStart` → `notifyPictureInPicture(true)` → `snapshot.isPictureInPicture`; controls overlay hidden while in PiP.
  3. `onPictureInPictureStop` → `false`.
  4. Failure result logged once, no crash.
  5. Web: uses `requestPictureInPicture` on the located `<video>` element; unsupported → hidden.
- **Increment:** 2, 3, 4.
- **Note:** iOS requires the `audio` background mode in `app.json` (`ios.infoPlist.UIBackgroundModes: ["audio"]`) for PiP to continue when the app backgrounds; this is a config change in Increment 2 and is recorded in the plan (no native code).

### F22 Keep screen awake while playing

- **Owner:** engine E2 (`player.keepScreenOnWhilePlaying = true`).
- **Acceptance:** property set at engine construction; asserted on the fake player. No `expo-keep-awake` import in the player.
- **Increment:** 1.

### F23 Brightness and volume swipe

- **Owner:** `gestures/useSwipeGestures.ts`, `platform/brightness.*`, engine `setVolume`, `ui/SwipeIndicator.tsx`.
- **Acceptance:**
  1. Pan starting in the left half adjusts brightness; right half adjusts volume; the half is decided at gesture begin from `event.x < layout.width / 2`.
  2. Delta = `-translationY / layout.height` added to the value at gesture begin; clamped 0..1.
  3. Indicator shows the level with an icon, hides `SWIPE_INDICATOR_HIDE_MS` after the gesture ends.
  4. Gesture activates only after `SWIPE_ACTIVATION_PX` vertical movement, so taps are unaffected.
  5. Disabled when minimized, when a sheet is open, or in error.
  6. Brightness restored on unmount (F10.6).
- **Constants:** `SWIPE_ACTIVATION_PX = 12`, `SWIPE_INDICATOR_HIDE_MS = 800`.
- **Increment:** 2 (adapter), 3 (gesture and indicator).

### F24 Quality display (manual selection later)

- **Owner:** `ui/SettingsSheet.tsx`, engine (`videoTrackChange` → `activeQuality`).
- **Acceptance:** Settings shows "Quality: Auto · 720p" read-only from `activeQuality.height`; row hidden when `activeQuality` is null. `selectQuality` is a no-op in expo-video 3.0.11 (read-only `videoTrack`); `PLAYER_FEATURE_FLAGS.qualitySelection` stays `false`; a later item records the library requirement.
- **Increment:** 1, 3.

### F25 Mini-player

- **Owner:** `ui/MiniPlayer.tsx`, `Player.tsx` (mode).
- **Acceptance:**
  1. When `isMinimized`, renders the same `VideoView` inside a `MINI_PLAYER_WIDTH` × 9/16 box with a play/pause button and a close button.
  2. Tapping the video area calls `onToggleMinimize` (restore).
  3. Close calls `onToggleMinimize` too; the app decides what "close" means (today: restore; a later item may stop playback). This is documented so the app owner can change it in one place.
  4. Captions and gestures disabled; progress bar hidden.
  5. Positioning (bottom-right over the screen) stays the responsibility of `app/video/[id].tsx`, as today.
- **Increment:** 3, 4.

### F26 Haptics

- **Owner:** `platform/haptics.*` (native `expo-haptics` light impact; web no-op), called from `useTapGestures` (double-tap) and `ProgressBar` (scrub release).
- **Acceptance:** exactly one `impactAsync` per double-tap and per scrub commit; none on web.
- **Increment:** 2, 3.

### F27 Toast

- **Owner:** `ui/Toast.tsx` with a tiny `useToast()` state in `Player.tsx`.
- **Acceptance:** shows one message at a time; new message replaces the current; auto-dismiss after `TOAST_MS`; `accessibilityLiveRegion="polite"`; positioned below the top row.
- **Constants:** `TOAST_MS = 1_500`.
- **Increment:** 3.

### F28 Web keyboard and hover

- **Owner:** `platform/keyboard.web.ts`, `Player.tsx` (maps `PlayerKey` to commands), `ui/PlayerSurface.tsx` (`onMouseMove` shows controls on web only via the adapter's `subscribeHover`).
- **Mapping:** Space and K → togglePlay; F → fullscreen toggle; M → mute toggle; Escape → exit fullscreen; ArrowLeft/ArrowRight → seekBy ∓/±`KEYBOARD_SEEK_SMALL_MS`; J/L → ∓/±`KEYBOARD_SEEK_LARGE_MS`; 0–9 → seekTo `digit / 10 * durationMs` (VOD only); `<`/`>` (Shift+comma/period) → previous/next rate in `PLAYBACK_RATES`; C → toggle captions.
- **Acceptance:** each key maps once; keys ignored when `event.target` is an input/textarea/contenteditable; listener removed on unsubscribe; hover shows controls and restarts the hide timer.
- **Increment:** 2, 4.

---

## Tier 3 — App actions (outside the player)

### F29 Action bar relocation

- **Owner:** `components/Video/actions/VideoActionBar.tsx`, rendered by `components/Video/VideoPlaybackContainer.tsx`.
- **Acceptance:** renders Like, Dislike (flag), Share, Download (flag, MP4 only), Clip (flag), Save, Thanks (flag), More; hidden when `isFullscreen || isMinimized`; the player has no action props (type test: `VideoPlayerProps` has no key containing "like", "save", "share", "download").
- **Increment:** 5 (move), 6 (container renders it).

### F30 Like and Dislike

- **Owner:** `components/Video/actions/useVideoActions.ts`, `services/videoActions/localVideoActionsRepository.ts`.
- **States:** idle, in-flight (button disabled, optimistic state shown), success, failure (rollback + toast from `AppError.message`), offline (local repository never fails for network reasons; a backend implementation would return `AppError("offline")`).
- **Acceptance:**
  1. Tap like → UI shows liked immediately → repository `setLike(id, true)` → confirmed state.
  2. Repository rejects → UI reverts → toast.
  3. Second tap while in flight is ignored.
  4. Response with a lower sequence number than the latest optimistic change is ignored.
  5. Like and dislike are mutually exclusive.
  6. Counts shown only when `state.counts !== null`.
- **Increment:** 5.
- **Tests:** `__tests__/components/actions/useVideoActions.test.tsx`, `__tests__/services/videoActions/localVideoActionsRepository.test.ts`.

### F31 Save

- **Owner:** `components/Video/actions/sheets/SaveSheet.tsx` + `contexts/SavedContext.tsx` (unchanged).
- **Acceptance:** behaviour identical to today's `VideoSaveSheet` (existing test `__tests__/player/VideoSaveSheet.test.tsx` moves with the file and still passes).
- **Increment:** 5.

### F32 Share

- **Owner:** `components/Video/actions/sheets/ShareSheet.tsx` + `services/shareLinkService.ts` (unchanged).
- **Acceptance:** identical to today (existing test moves and passes).
- **Increment:** 5.

### F33 Download (MP4 only)

- **Owner:** `components/Video/actions/sheets/DownloadSheet.tsx`, `services/videoActions/downloadService.ts`, `services/storage/downloadsStorage.ts`.
- **States:** not downloaded (button "Download"), queued, downloading (progress ring 0..1, Pause, Cancel), paused (Resume, Cancel), completed (badge "Downloaded", Delete), failed (message, Retry, Delete), storage full (failure message from `AppError("storage_full")`), HLS source (button hidden).
- **Acceptance:**
  1. Start creates `<documentDirectory>/videos/` if missing and a resumable download to `<videoId>.mp4`.
  2. Progress events update the registry at most every `DOWNLOAD_PROGRESS_THROTTLE_MS`.
  3. Pause/resume use the resumable's `pauseAsync`/`resumeAsync` and persist `resumeData`.
  4. Cancel deletes the partial file and the registry entry.
  5. App restart with a `downloading` entry → shown as `paused` (resume possible).
  6. Container prefers `file://` when the registry says `completed` and `getInfoAsync().exists`.
  7. Delete removes the file and the entry; the container falls back to the network source.
  8. Only one active download at a time (`MAX_CONCURRENT_DOWNLOADS = 1`); others queue.
- **Constants (app):** `TIMING.downloadProgressThrottleMs = 500`, `LIMITS.maxConcurrentDownloads = 1`, `STORAGE_KEYS.downloads = "yagna.downloads.v1"`.
- **Increment:** 5, 6.
- **Tests:** `__tests__/services/videoActions/downloadService.test.ts`, `__tests__/components/actions/DownloadSheet.test.tsx`, container test for `file://` preference.

### F34 Clip editor (metadata only)

- **Owner:** `components/Video/actions/sheets/ClipEditor.tsx`, repository `createClip`.
- **Acceptance:** start/end selection UI as today; `createClip` stores `{ id, videoId, startMs, endMs, createdAt }` locally and returns the id; the sheet's copy says "Clip saved to this device" and the button says "Save clip"; no video processing; `startMs < endMs`, both within duration, minimum `CLIP_MIN_MS`, maximum `CLIP_MAX_MS`.
- **Constants (app):** `LIMITS.clipMinMs = 1_000`, `LIMITS.clipMaxMs = 60_000`.
- **Increment:** 5.

### F35 Report, Not interested, Don't recommend channel

- **Owner:** `components/Video/actions/sheets/ReportSheet.tsx`, `OverflowMenu.tsx`, repository.
- **Acceptance:** report reasons from constants; second report of the same video is a no-op with the same toast; not-interested and don't-recommend persist locally and toast; menu items Help, Quality, Captions removed (quality and captions now live in the player settings sheet).
- **Increment:** 5.

### F36 Thanks

- **Owner:** `components/Video/actions/sheets/ThanksSheet.tsx`, `services/videoActions/PaymentProvider.ts`, `unavailablePaymentProvider.ts`.
- **States:** presets shown; amount selected; provider unavailable → "Thanks is coming soon" with Confirm disabled; (future) processing, succeeded, cancelled, failed.
- **Acceptance:** with the unavailable provider Confirm is disabled and no `createIntent` call happens; with a fake available provider in tests the full success and failure paths render; `PLAYER_FEATURE_FLAGS.thanks` gates the button.
- **Increment:** 5.

### F37 Feature flags

- **Owner:** `constants/config.ts`.
- **Rule:** a flag flips to `true` only in the commit that adds its passing acceptance tests. After Increment 7: `download` true, `pictureInPicture` true (player-side, F21), `qualitySelection` false, `clipEditor` true, `thanks` false (human decides on the teaser), `report` true, `dislike` true. This table is repeated in `10-migration-and-swap.md` and must match.

### F38 Analytics

- **Owner:** `services/analytics.ts` (`track`), called from `useVideoActions` and `downloadService`.
- **Events:** `action_like`, `action_dislike`, `action_save`, `action_share`, `download_start`, `download_complete`, `download_fail`, `clip_create`, `report_submit`, `thanks_open`. Payload: `{ videoId }` plus `{ code }` on failure. No URLs, no personal data.
- **Increment:** 5.

---

## Later items (documented, not scheduled)

| Item | Blocked by |
|---|---|
| Manual quality selection | expo-video with writable `videoTrack` |
| Offline HLS download | native offline API in expo-video |
| Android immersive navigation bar in fullscreen | `expo-navigation-bar` dependency decision (O4) |
| Auto-resume on foreground | human decision (O2) |
| Now-playing notification and background audio | human decision (O5) |
| Persisting resume position and captions preference | app storage item (`watchHistoryStorage`) |
| Shorts migration to the engine | ADR 0011 |
| Manage downloads screen | app UX item |
| Removing `react-native-paper` | dependency ADR (O3) |
