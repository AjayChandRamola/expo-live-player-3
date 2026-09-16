# 06 — UI and Gestures Specification

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 6 |
| ADRs | 0003, 0004 |
| Folders | `components/VideoPlayer/ui/`, `components/VideoPlayer/gestures/`, `components/VideoPlayer/hooks/` |
| Libraries | `react-native-reanimated ~4.1.1` (all motion), `react-native-gesture-handler ~2.28.0` (all gestures), `@expo/vector-icons` `MaterialCommunityIcons` (all icons), `expo-image` (poster), `react-native-safe-area-context` (insets) |

## 1. Layout modes

| Mode | Container style | Video | Chrome | When |
|---|---|---|---|---|
| `inline` | `width: "100%"`, `height: min(windowHeight × INLINE_MAX_HEIGHT_RATIO, windowWidth / ASPECT_16_9)`, `backgroundColor: tokens.color.videoBackground`, `overflow: "hidden"`; in landscape (non-fullscreen) `aspectRatio: ASPECT_16_9` instead of height | `contentFit="contain"` | app default | default |
| `fullscreen` | `position: "absolute"`, `top/left/right/bottom: 0`, `zIndex: tokens.z.fullscreen`, `backgroundColor: videoBackground` | contain | status bar hidden; landscape locked; controls padded by safe-area insets | after `fullscreen.enter()` |
| `minimized` | `width: MINI_PLAYER_WIDTH`, `height: MINI_PLAYER_WIDTH × 9/16`, `borderRadius: tokens.radius.md`, `overflow: "hidden"` | contain | none | `props.isMinimized` |

`useWindowDimensions()` supplies width/height (subscribes and unsubscribes itself). `Dimensions.addEventListener` is not used.

The `VideoView` is rendered once, inside `PlayerSurface`, in all modes. Mode changes only change the parent `View` style.

## 2. Control positions (`ControlsOverlay`)

```
inset = 12 + safe-area (fullscreen only)

TOP ROW (flexDirection row, justifyContent space-between, alignItems center)
  left:   [MinimizeButton]                 (hidden in fullscreen: minimize from fullscreen exits fullscreen first, handled by root)
  centre: [LiveBadge]                      (only when isLive)
  right:  [AutoplayToggle] [PipButton] [SettingsButton]

CENTRE ROW (absolute, full size, justifyContent/alignItems center; row of three)
  [SkipButton previous]  [PlayPauseButton | BufferingIndicator | (nothing in error/ended)]  [SkipButton next]
  gap: tokens.space.lg

BOTTOM ROW (column)
  line 1: [TimeLabel]  ....................................  [GoLiveButton] [MuteButton] [FullscreenButton]
  line 2: [ProgressBar]
```

Overlay root: `position: absolute; inset 0; pointerEvents: visible ? "box-none" : "none"`; a scrim (`tokens.color.scrim`) fades with the controls. Icons: `play`, `pause`, `replay`, `skip-previous`, `skip-next`, `fullscreen`, `fullscreen-exit`, `volume-high`, `volume-off`, `picture-in-picture-bottom-right`, `cog-outline`, `arrow-collapse` (minimize), `arrow-expand` (restore), `access-point` (live), `closed-caption-outline`.

## 3. Controls visibility (`gestures/useControlsVisibility.ts`)

Inputs: `{ status, isSheetOpen, isMinimized }`. Outputs: `{ visible, opacity (SharedValue), show, hide, onInteraction }`.

| Rule | Behaviour |
|---|---|
| V1 | On mount: `visible = true`; start `INITIAL_VISIBLE_MS` timer; when it fires and `status === "playing"` → hide. |
| V2 | `onInteraction()`: `show()`; restart the `AUTO_HIDE_MS` timer. |
| V3 | Timer fire: hide only if `status === "playing"` and `!isSheetOpen`; otherwise do nothing (stay visible). |
| V4 | `status` becomes anything other than `playing` → `show()` and clear timers. |
| V5 | `status` becomes `playing` (from any other) → restart the `AUTO_HIDE_MS` timer. |
| V6 | `isSheetOpen` true → `show()`; false → restart timer. |
| V7 | `isMinimized` true → timers cleared; `visible` irrelevant (MiniPlayer renders its own buttons). |
| V8 | Unmount → clear timers. |
| V9 | `show()`: `opacity.value = withTiming(1, { duration: CONTROLS_FADE_MS })`; set `visible` true immediately. `hide()`: `withTiming(0, …, finished => finished && runOnJS(setVisible)(false))` so `pointerEvents` flips to `"none"` only after the fade completes. |

Tests (fake timers): mount → visible; advance 3,000 while playing → hidden; tap → visible; advance 3,500 → hidden; pause → visible and stays; sheet open → stays; unmount → `jest.getTimerCount() === 0`.

## 4. Gestures

All gestures are attached with one `GestureDetector` around `PlayerSurface`, composed as `Gesture.Simultaneous(Gesture.Exclusive(doubleTap, singleTap), longPress, verticalPan)`.

### 4.1 `useTapGestures`

| Gesture | RNGH definition | Behaviour |
|---|---|---|
| single tap | `Gesture.Tap().numberOfTaps(1).maxDuration(DOUBLE_TAP_WINDOW_MS)` | `onToggleControls()`; `onInteraction()` |
| double tap | `Gesture.Tap().numberOfTaps(2).maxDelay(DOUBLE_TAP_WINDOW_MS)` | zone = `e.x < w/3 ? "left" : e.x > 2w/3 ? "right" : "centre"`; left → `commands.seekBy(-SKIP_MS)`, `haptics.light()`, `onSkipFeedback("back")`; right → `+SKIP_MS`, `"forward"`; centre → `commands.togglePlay()`; always `onInteraction()` |
| long press | `Gesture.LongPress().minDuration(LONG_PRESS_MS)` | `onStart`: `onLongPressRate(true)` (root calls `setRate(LONG_PRESS_RATE)` and remembers the previous rate); `onEnd`/`onFinalize`: `onLongPressRate(false)` (root restores) |

Zones use `layout.width` from `onLayout`. When `enabled` is false every gesture is `.enabled(false)`.

Skip feedback: `SkipFeedback` view (inside `ControlsOverlay`) shows a ripple and "-10s"/"+10s" for `SKIP_FEEDBACK_MS` at the tapped third.

### 4.2 `useSwipeGestures`

| Step | Behaviour |
|---|---|
| begin | `side = e.x < w/2 ? "brightness" : "volume"`; `startLevel = side === "brightness" ? await brightness.get() : initialVolume` |
| activation | `Gesture.Pan().activeOffsetY([-SWIPE_ACTIVATION_PX, SWIPE_ACTIVATION_PX]).failOffsetX([-SWIPE_ACTIVATION_PX, SWIPE_ACTIVATION_PX])` so horizontal drags (progress bar) and taps do not trigger |
| update | `level = clamp(startLevel - e.translationY / h, 0, 1)`; brightness → `brightness.set(level)`; volume → `commands.setVolume(level)`; `onLevel(side, level)` |
| end | `onLevel(side, null)` after `SWIPE_INDICATOR_HIDE_MS` |

Disabled when `enabled` is false (minimized, sheet open, error).

### 4.3 ProgressBar scrub (inside `ProgressBar.tsx`)

`Gesture.Pan().activeOffsetX([-4, 4])` on the bar; `onBegin` → `onSeekStart()`; `onUpdate` → `previewMs = fractionToMs(clamp(e.x / barWidth, 0, 1))`, `onSeekPreview(previewMs)`; `onEnd` → `onSeekCommit(previewMs)`, `haptics.light()`; `onFinalize` when cancelled (orientation change unmounts/re-lays out) → `onSeekCancel()`. Tap: `Gesture.Tap()` → commit at `e.x`.

## 5. Component specifications

Every component: function component, `memo` only where the props are stable and the test shows a re-render saving (ProgressBar, CaptionsView, ControlsOverlay). Styles via `StyleSheet.create` at module scope using tokens. No inline object literals in JSX except animated styles.

### 5.1 `ControlButton`

Props in spec 6.5. Renders `Pressable` → `Animated.View` (scale shared value: `withSpring(0.9)` on press-in, `withSpring(1)` on press-out) → `MaterialCommunityIcons`. `hitSlop` = `(44 - size) / 2` when `size < 44`. `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{ disabled, selected: active }}`. Disabled: `opacity: tokens.opacity.disabled`, `onPress` not called.

### 5.2 State-driven buttons

| Component | Icon / label by state | onPress |
|---|---|---|
| `PlayPauseButton` | `playing` → `pause`/"Pause"; `paused`,`ready` → `play`/"Play"; `ended` → `replay`/"Replay"; hidden in `loading`,`buffering`,`error`,`idle` | `togglePlay` or `replay` |
| `SkipButton` | `direction === "previous"` → `skip-previous`/"Previous video"; `next` → `skip-next`/"Next video"; `disabled = !hasX` | `onPrevious`/`onNext` |
| `FullscreenButton` | `isFullscreen` → `fullscreen-exit`/"Exit fullscreen"; else `fullscreen`/"Fullscreen" | `onToggleFullscreen` |
| `MuteButton` | `muted` → `volume-off`/"Unmute"; else `volume-high`/"Mute" | `setMuted(!muted)` |
| `AutoplayToggle` | `enabled` → active state, label "Autoplay on"; else "Autoplay off"; icon `play-circle-outline`; `disabled = !hasNext` | `onToggleAutoplayNext(!enabled)` |
| `PipButton` | `picture-in-picture-bottom-right`/"Picture in picture"; hidden when `!supported` | `onPip` |
| `SettingsButton` | `cog-outline`/"Settings" | `onOpenSettings` |
| `MinimizeButton` | `arrow-collapse`/"Minimize player" | `onToggleMinimize` |
| `GoLiveButton` | text button "Go live"; visible when `isLive && liveOffsetMs !== null && liveOffsetMs > LIVE_EDGE_TOLERANCE_MS` | `goToLive` |
| `LiveBadge` | red dot + "LIVE"; `accessibilityLabel="Live"`; not pressable | — |

### 5.3 `ProgressBar`

Props: `positionMs, durationMs, bufferedMs, chapters?, isLive, liveWindowMs, disabled, onSeekStart, onSeekPreview, onSeekCommit, onSeekCancel, haptics`. Layers (bottom to top): track (`tokens.color.track`), buffered (`tokens.color.buffered`, width `bufferedMs/durationMs`), played (`tokens.color.accent`, width `(scrubbing ? previewMs : positionMs)/durationMs`), chapter ticks (`tokens.color.chapterTick`, 2 px wide at `startMs/durationMs`, `hitSlop CHAPTER_MARKER_HIT_SLOP`, tap seeks), thumb (`tokens.size.thumb`, scales `withSpring(1.4)` while scrubbing), preview label above thumb while scrubbing (`formatTime(previewMs)`). Bar height `tokens.size.progressBar`, hit area 44 via `hitSlop`. Hidden when `isLive && liveWindowMs === 0`. Accessibility per F14.3. Pure helpers `msToFraction(ms, durationMs)`, `fractionToMs(f, durationMs)` in `engine/pure/`.

### 5.4 `TimeLabel`

Text `formatTime(positionMs)` + " / " + `formatTime(durationMs)`; live: "LIVE" or `-${formatTime(liveOffsetMs)}` when behind edge; chapter title appended after " · " (one line, `numberOfLines={1}`). `formatTime`: `m:ss` under one hour, `h:mm:ss` otherwise; negative or NaN → "0:00".

### 5.5 `CaptionsView`

Props `captions, positionMs`. `useMemo` cue via `selectCue`. Renders nothing when no cue. Text style: `fontSize: CAPTION_FONT_SIZE * PixelRatio.getFontScale()`, colour `tokens.color.captionText`, background `tokens.color.captionBackground`, padding `tokens.space.xs`, `textAlign: "center"`, `maxWidth: 90%`, positioned `bottom: tokens.size.bottomRowHeight + tokens.space.sm`. `accessibilityLiveRegion="polite"`.

### 5.6 `BufferingIndicator`

Props `status`. Shows `ActivityIndicator` (size large, colour `tokens.color.onVideo`) after `BUFFERING_INDICATOR_DELAY_MS` when `status` is `loading` or `buffering`; hides immediately otherwise. `accessibilityLabel="Loading"`. Timer cleared on unmount.

### 5.7 `ErrorCard`

Props `error, retryAttempt, onRetry`. Hidden when `error === null`. Card (`tokens.color.surface`, radius `md`, padding `lg`): icon `alert-circle-outline`, `error.message`, then: if `retryAttempt > 0 && retryAttempt <= MAX_RETRIES && error.retryable && retrying` → "Retrying ({n}/{MAX_RETRIES})…" + small spinner; else if `error.retryable` → button "Retry" (`ControlButton` text variant) → `onRetry`; else nothing. `accessibilityLiveRegion="assertive"`. The root passes `retrying = snapshot.status === "loading" && retryAttempt > 0` — so the props are `{ error, retryAttempt, retrying, onRetry }`.

### 5.8 `EndScreen`

Props `visible, canAutoplayNext, secondsLeft: number | null, onReplay, onCancelAutoplay`. Shows replay button ("Replay") and, when `secondsLeft !== null`, "Up next in {n}" with a "Cancel" text button. Countdown logic lives in `hooks/useEndScreenCountdown.ts` (root): on `status === "ended"` and `enabled && hasNext` → start a 1 s interval decrementing from `END_SCREEN_COUNTDOWN_MS / 1000`; at 0 → `onFinished()` once and stop; cancel → stop and `secondsLeft = null`; leaving `ended` → stop. Interval cleared on unmount.

### 5.9 `Toast`

Props `message: string | null`. Fades in/out with Reanimated; `useToast()` in `hooks/` keeps `{ message, show(text) }` with a `TOAST_MS` timer that replaces on new message and clears on unmount. `accessibilityLiveRegion="polite"`.

### 5.10 `SwipeIndicator`

Props `level: { kind: "brightness" | "volume"; level: number } | null`. Vertical bar (`tokens.size.swipeIndicatorHeight`) with fill = level, icon `brightness-6` or `volume-high`, positioned at the left or right third centre. Hidden when null.

### 5.11 `SettingsSheet`

Props `visible, onClose, rate, onRate, captionsEnabled, captionsAvailable, onToggleCaptions, subtitleTracks, activeSubtitle, onSelectSubtitle, activeQualityLabel: string | null`. A bottom sheet built with `Modal` (transparent, `animationType="slide"`, `onRequestClose={onClose}`), backdrop press closes. Rows: "Speed" (segmented list of `PLAYBACK_RATES`, active marked), "Captions" (switch; hidden when `!captionsAvailable`; track list when `subtitleTracks.length > 0`), "Quality" (read-only label; hidden when null). Each row has a label and `accessibilityRole`. Web: Escape closes.

Why `Modal` here and not for fullscreen: the sheet is transient chrome, not the video surface; a `Modal` sheet does not touch `VideoView`.

### 5.12 `MiniPlayer`

Props `snapshot, commands, onRestore, onClose`. Layout: the video (slot from `PlayerSurface`) with a right-side column: `PlayPauseButton` (sm), close `ControlButton` (`close`, "Close mini player"). Pressing the video area → `onRestore`. No progress bar, captions, or gestures.

### 5.13 `PlayerSurface`

Props in `03-architecture.md` §4.12. Renders: container `View` (`onLayout`, `testID`), `VideoView` (`style: absoluteFill`, `player`, `contentFit`, `nativeControls={false}`, `allowsFullscreen={false}`, `allowsPictureInPicture`, `startsPictureInPictureAutomatically={allowsPictureInPicture}`, `onPictureInPictureStart/Stop`, `surfaceType="surfaceView"` on Android default), poster `Image` (`expo-image`, `absoluteFill`, `contentFit="contain"`, `accessible={false}`) when `showPoster && posterUrl`, then `children`. `forwardRef` to the `VideoView`.

## 6. Tokens (`components/VideoPlayer/tokens.ts`)

```ts
import { Spacing, Radius } from "../../constants/tokens"; // reuse where present; verify names in constants/tokens.ts before importing

export const tokens = {
  color: {
    videoBackground: "#000000",
    onVideo: "#FFFFFF",
    scrim: "rgba(0,0,0,0.35)",
    surface: "rgba(28,28,30,0.92)",
    track: "rgba(255,255,255,0.3)",
    buffered: "rgba(255,255,255,0.5)",
    accent: "#FF6D00",              // Yagna saffron; confirm against constants/theme.ts tint if a brand accent exists
    chapterTick: "rgba(255,255,255,0.85)",
    live: "#E53935",
    captionText: "#FFFFFF",
    captionBackground: "rgba(0,0,0,0.6)",
  },
  size: { controlSm: 32, controlMd: 44, controlLg: 64, thumb: 12, progressBar: 3, bottomRowHeight: 56, swipeIndicatorHeight: 120 },
  space: { xs: 4, sm: 8, md: 12, lg: 24 },
  radius: { md: 8 },
  opacity: { disabled: 0.4 },
  z: { fullscreen: 1000, overlay: 10, toast: 20, sheet: 30 },
} as const;
```

If `constants/tokens.ts` already defines spacing or radius scales, import them instead of duplicating the numbers and note it in the Increment 1 report.

## 7. Constants (`components/VideoPlayer/constants.ts`) — complete list

| Name | Value |
|---|---|
| `ASPECT_16_9` | `16 / 9` |
| `INLINE_MAX_HEIGHT_RATIO` | `0.304` |
| `MINI_PLAYER_WIDTH` | `160` |
| `INITIAL_VISIBLE_MS` | `3_000` |
| `AUTO_HIDE_MS` | `3_500` |
| `CONTROLS_FADE_MS` | `200` |
| `DOUBLE_TAP_WINDOW_MS` | `300` |
| `SKIP_MS` | `10_000` |
| `SKIP_FEEDBACK_MS` | `600` |
| `LONG_PRESS_MS` | `500` |
| `LONG_PRESS_RATE` | `2` |
| `SWIPE_ACTIVATION_PX` | `12` |
| `SWIPE_INDICATOR_HIDE_MS` | `800` |
| `BUFFERING_INDICATOR_DELAY_MS` | `300` |
| `END_SCREEN_COUNTDOWN_MS` | `5_000` |
| `TOAST_MS` | `1_500` |
| `CAPTION_FONT_SIZE` | `16` |
| `CHAPTER_MARKER_HIT_SLOP` | `8` |
| `LIVE_EDGE_TOLERANCE_MS` | `10_000` |
| `KEYBOARD_SEEK_SMALL_MS` | `5_000` |
| `KEYBOARD_SEEK_LARGE_MS` | `10_000` |
| `FULLSCREEN_ON_ROTATE` | `true` |
| engine constants | see `04-playback-engine-spec.md` §7 |

## 8. Accessibility checklist (run per component test)

- [ ] `accessibilityRole` set (`button`, `adjustable`, `switch`, `text`).
- [ ] `accessibilityLabel` non-empty and state-aware.
- [ ] `accessibilityState` for `disabled`/`selected`/`checked`.
- [ ] Touch target ≥ 44 × 44 (size or `hitSlop`).
- [ ] Live regions on toast, error card, captions.
- [ ] No information conveyed by colour alone (live badge has text; disabled has state).
- [ ] Web: focusable controls render a visible focus style (`:focus-visible` via `react-native-web` `style` with `outlineStyle`? Not typed on native — use a `focused` state from `onFocus/onBlur` on `Pressable` and a border token).

## 9. Web parity notes

- `PlayerSurface` receives `onMouseMove` only through the keyboard adapter's `subscribeHover` (so native files carry no mouse props).
- The composition root registers the surface element with the fullscreen and brightness adapters via `getElement: () => surfaceRef.current` (on web `react-native-web` exposes the DOM node from the ref).
- Fullscreen on web relies on the browser; the layout mode still switches to `fullscreen` so the overlay uses full-window positions.
