# 03 — Player Architecture and Module Contracts

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` sections 3, 4.6 |
| ADRs | 0001, 0002, 0005, 0006, 0011 |
| Purpose | Tell an implementer exactly which file does what, what it may import, what it exposes, and how to prove it works. |

## 1. One-paragraph summary

The player is a self-contained component under `components/VideoPlayer/`. It has four internal layers: a headless **engine** that turns expo-video events into an immutable snapshot, **platform adapters** that hide native and web differences, **gestures and UI** that render the snapshot and issue commands, and a **composition root** that wires them. The app talks to the player through `VideoPlayerProps` only, from one file, `components/Video/VideoPlaybackContainer.tsx`. App actions (like, save, share, download, clip, report, thanks) live beside the container in `components/Video/actions/` and persist through repositories in `services/videoActions/`.

## 2. Dependency rules

```
app/video/[id].tsx
   │ renders
   ▼
components/Video/VideoPlaybackContainer.tsx ──renders──► components/Video/actions/VideoActionBar.tsx
   │ imports (the only importer)                              │ uses
   ▼                                                          ▼
components/VideoPlayer/index.tsx  (re-export)        components/Video/actions/useVideoActions.ts
   ▼                                                          │ uses
components/VideoPlayer/Player.tsx  (composition root)         ▼
   │ uses                                            services/videoActions/VideoActionsRepository (interface)
   ├─► engine/usePlaybackEngine ─► engine/PlaybackEngine ─► expo-video      ▲ implemented by
   ├─► platform/* (interfaces; .native/.web resolved by Metro)              services/videoActions/localVideoActionsRepository
   ├─► gestures/*                                                            services/storage/asyncStorageAdapter
   └─► ui/* ─► engine/types, constants, tokens, reanimated, gesture-handler
```

| Rule | Statement | Enforced by |
|---|---|---|
| R1 | Only the container imports `components/VideoPlayer`. | `__tests__/player/invariants.test.ts` |
| R2 | Nothing under `components/VideoPlayer/` imports `contexts/`, `services/`, `hooks/`, `app/` at runtime. Type-only imports from `types/domain.ts` are allowed. | invariants test |
| R3 | Only `engine/PlaybackEngine.ts`, `engine/usePlaybackEngine.ts`, `ui/PlayerSurface.tsx` import `expo-video`. | invariants test |
| R4 | No `Platform.OS` or `Platform.select` outside `platform/`. | invariants test |
| R5 | No RN `Animated`, no `react-native-paper` in the player. | invariants test |
| R6 | No `any` in the player. | invariants test + `npx tsc --noEmit` strict |
| R7 | `components/Shorts/` and `hooks/useShortsPlayer.ts` unchanged. | invariants test (`git diff --quiet main -- …`) |
| R8 | `ui/` and `gestures/` never call a method on the expo-video player; they only receive snapshot values and `PlaybackCommands`. | code review; grep for `player.` in those folders |
| R9 | Every file under the player is under 200 lines except `Player.tsx` (under 200 as a target, hard limit 250) and `playbackReducer.ts` (table-driven, under 300). | `09-test-plan.md` line-count check |

## 3. Folder map with responsibilities

```
components/VideoPlayer/
├── index.tsx                  Re-export: `export { Player as default } from "./Player"; export type * from "./types";`
│                              Unchanged until the swap (Increment 6). Before the swap it is the OLD player.
├── Player.tsx                 Composition root (section 5).
├── types.ts                   VideoPlayerProps, VideoPlayerSource (public API). Re-exports PlaybackSnapshot type.
├── constants.ts               Every timing, threshold, list, and message. See 06 §7 for the full table.
├── tokens.ts                  Colours, sizes, z-indexes; imports base values from constants/tokens.ts.
├── engine/
│   ├── types.ts               PlaybackStatus, PlaybackSnapshot, PlaybackError, EngineEvent, PlaybackCommands, EngineOptions.
│   ├── initialSnapshot.ts     `createInitialSnapshot(): PlaybackSnapshot` (status idle, zeros, nulls).
│   ├── playbackReducer.ts     Pure (prev, event) → next. Transition table = spec 4.2.
│   ├── retryPolicy.ts         Pure nextRetryDelayMs(attempt, error).
│   ├── classifyError.ts       Pure native message → PlaybackError.
│   ├── PlaybackEngine.ts      Class wrapping one expo-video VideoPlayer. Subscriptions, timers, commands.
│   ├── usePlaybackEngine.ts   React hook: creates player + engine, AppState, useSyncExternalStore, position cadence.
│   └── pure/
│       ├── selectCue.ts       captions cue lookup.
│       ├── currentChapter.ts  chapter lookup.
│       ├── clamp.ts           clamp(n, min, max).
│       └── formatTime.ts      ms → "m:ss" / "h:mm:ss".
├── platform/
│   ├── types.ts               AdapterResult and all adapter interfaces.
│   ├── fullscreen.native.ts   fullscreen.web.ts
│   ├── orientation.native.ts  orientation.web.ts
│   ├── systemChrome.native.ts systemChrome.web.ts
│   ├── keyboard.native.ts     keyboard.web.ts
│   ├── pictureInPicture.native.ts pictureInPicture.web.ts
│   ├── brightness.native.ts   brightness.web.ts
│   ├── haptics.native.ts      haptics.web.ts
│   └── index.ts               Named exports of the resolved adapters: `export { fullscreenAdapter } from "./fullscreen"` etc.
├── gestures/
│   ├── useControlsVisibility.ts
│   ├── useTapGestures.ts
│   └── useSwipeGestures.ts
├── hooks/                     Root-only glue hooks (section 5); each under 80 lines; import only from engine/, platform/, constants.
│   ├── useLayoutMode.ts  useFullscreen.ts  useSurfaceLayout.ts  useToast.ts
│   └── useOnStateChange.ts  useEndScreenCountdown.ts  useKeyboardShortcuts.ts
└── ui/
    ├── PlayerSurface.tsx      VideoView + poster + children overlay slot. Exposes VideoView ref for PiP.
    ├── ControlsOverlay.tsx    Positions all controls (top, centre, bottom rows).
    ├── ProgressBar.tsx
    ├── TimeLabel.tsx
    ├── CaptionsView.tsx
    ├── BufferingIndicator.tsx
    ├── ErrorCard.tsx
    ├── EndScreen.tsx
    ├── Toast.tsx
    ├── SwipeIndicator.tsx
    ├── SettingsSheet.tsx
    ├── MiniPlayer.tsx
    └── controls/
        ├── ControlButton.tsx  the one pressable primitive
        ├── PlayPauseButton.tsx
        ├── SkipButton.tsx
        ├── FullscreenButton.tsx
        ├── MuteButton.tsx
        ├── AutoplayToggle.tsx
        ├── PipButton.tsx
        ├── SettingsButton.tsx
        ├── MinimizeButton.tsx
        ├── GoLiveButton.tsx
        └── LiveBadge.tsx

components/Video/
├── VideoPlaybackContainer.tsx  Domain → player props; renders VideoActionBar; prefers file:// when downloaded.
├── VideoMeta.tsx               (existing, unchanged)
└── actions/
    ├── VideoActionBar.tsx
    ├── VideoActionButton.tsx
    ├── useVideoActions.ts
    ├── VideoActionsProvider.tsx  Context that injects the repository, payment provider, download service.
    └── sheets/
        ├── SaveSheet.tsx  ShareSheet.tsx  DownloadSheet.tsx  ClipEditor.tsx
        ├── ReportSheet.tsx  ThanksSheet.tsx  OverflowMenu.tsx

services/videoActions/
├── VideoActionsRepository.ts       interface + types
├── localVideoActionsRepository.ts  AsyncStorage implementation
├── downloadService.ts              expo-file-system resumable downloads + registry
├── PaymentProvider.ts              interface + types
└── unavailablePaymentProvider.ts   the only shipped provider

services/storage/
└── downloadsStorage.ts             registry persistence (same pattern as savedStorage.ts)
```

## 4. Module cards

Each card: **Responsibility** (one sentence), **Interface** (exact exports), **Depends on**, **Must not**, **Proof** (test file and the assertions that matter).

### 4.1 `engine/types.ts`
- **Responsibility:** Define every type the engine, UI and root share.
- **Interface:** as in spec 4.1, verbatim.
- **Depends on:** nothing.
- **Proof:** compiles under strict; `__tests__/player/engine/types.test-d.ts` is not needed (no runtime); referenced by every engine test.

### 4.2 `engine/initialSnapshot.ts`
- **Interface:** `export function createInitialSnapshot(overrides?: Partial<PlaybackSnapshot>): PlaybackSnapshot`.
- **Values:** `status: "idle"`, all numbers 0, `playbackRate: 1`, `volume: 1`, `muted: false`, `isLive: false`, `liveOffsetMs: null`, `error: null`, `retryAttempt: 0`, empty arrays, nulls, `isPictureInPicture: false`, `isPlayingBeforeBackground: false`.
- **Proof:** snapshot equality test.

### 4.3 `engine/playbackReducer.ts`
- **Responsibility:** Own every status transition.
- **Interface:** `export function playbackReducer(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot`.
- **Depends on:** `types.ts`, `constants.ts` (`MIN_BUFFER_AHEAD_MS`, `MAX_RETRIES`).
- **Must not:** import React, React Native, expo-video; call any function with side effects except `console.warn` gated on `__DEV__` for ignored pairs.
- **Structure:** a `switch (event.type)` whose cases call small helpers (`onStatusChange`, `onTimeUpdate`, …). Each helper is under 30 lines. Ignored pairs return `prev` (same reference).
- **Proof:** `__tests__/player/engine/playbackReducer.test.ts`: a `TRANSITIONS` array of `{ from, event, expectStatus, expectFields? }` covering every non-empty cell in spec 4.2; a loop asserting ignored pairs return `prev` by reference; an invariant loop over all statuses × all events.

### 4.4 `engine/retryPolicy.ts`
- **Interface:** `export function nextRetryDelayMs(attempt: number, error: PlaybackError): number | null`.
- **Proof:** attempts 0, 1, 2 return 1000, 2000, 4000; attempt 3 → null; non-retryable → null at attempt 0.

### 4.5 `engine/classifyError.ts`
- **Interface:** `export function classifyError(nativeMessage: string | undefined): PlaybackError`; `export function stripQuery(text: string): string`.
- **Proof:** one test per substring in spec 4.3; `stripQuery("https://a/b?tok=1 failed")` → `"https://a/b failed"`; undefined → unknown.

### 4.6 `engine/PlaybackEngine.ts`
- **Responsibility:** Bridge one expo-video player to the reducer; own subscriptions, the stall/retry/load-timeout timers, and command validation.
- **Interface:** spec 4.4 class signature. Additionally `export type EngineVideoPlayer = Pick<VideoPlayer, "play" | "pause" | "replace" | "replay" | "seekBy" | "addListener" | "currentTime" | "duration" | "playing" | "muted" | "volume" | "playbackRate" | "loop" | "bufferedPosition" | "isLive" | "currentOffsetFromLive" | "targetOffsetFromLive" | "timeUpdateEventInterval" | "keepScreenOnWhilePlaying" | "staysActiveInBackground" | "showNowPlayingNotification" | "preservesPitch" | "subtitleTrack" | "availableSubtitleTracks" | "videoTrack" | "availableVideoTracks" | "status">` so tests can pass a fake.
- **Depends on:** `expo-video` (types and the `VideoPlayer` class type), `types.ts`, `playbackReducer.ts`, `retryPolicy.ts`, `classifyError.ts`, `constants.ts`.
- **Must not:** import React; call `player.release()`; log outside `devLog()` (a single function that no-ops unless `__DEV__`).
- **Internal state:** `snapshot`, `disposables: Array<{ remove(): void }>`, `stallTimer`, `retryTimer`, `loadTimer`, `currentSource`, `pendingStartMs`, `lastTimeUpdateAt`.
- **Proof:** `__tests__/player/engine/PlaybackEngine.test.ts` with `fakeVideoPlayer` (see `09-test-plan.md` §4.1). Assertions: subscription count on construct equals the event list length; dispose empties `disposables` and clears timers (fake timers: `jest.getTimerCount() === 0`); each E-rule in spec 4.4.

### 4.7 `engine/usePlaybackEngine.ts`
- **Interface:** spec 4.5.
- **Depends on:** React, `react-native` `AppState`, `expo-video` `useVideoPlayer`, `PlaybackEngine`.
- **Behaviour:** `useVideoPlayer(null)` once → `useRef(new PlaybackEngine(player, options, publish))` → `useSyncExternalStore(subscribe, getSnapshot)` → effects for source change and AppState → position cadence with `setInterval`? **No.** The cadence is derived: on each snapshot where `status === "playing"` and `positionMs - lastReportedMs >= POSITION_REPORT_INTERVAL_MS`, call `onPositionChange`. Also on transitions to `paused`, `ended`, after seek commit, and in the unmount cleanup. No timer.
- **Proof:** `__tests__/player/engine/usePlaybackEngine.test.tsx` with `renderHook`; assertions F10.1–F10.6, F15.1–F15.4.

### 4.8 `platform/types.ts` and adapters
- See `05-platform-adapters-spec.md`. Each adapter file exports one const object implementing its interface, for example `export const fullscreenAdapter: FullscreenAdapter = { … }`. `platform/index.ts` re-exports them so consumers import from `"../platform"` and Metro picks the platform file.
- **Proof:** `__tests__/player/platform/<name>.native.test.ts` (default Jest config) and `<name>.web.test.ts` (`jest.web.config.js`).

### 4.9 `gestures/useControlsVisibility.ts`
- **Interface:** `export function useControlsVisibility(input: { status: PlaybackStatus; isSheetOpen: boolean; isMinimized: boolean }): { visible: boolean; opacity: SharedValue<number>; show(): void; hide(): void; onInteraction(): void }`.
- **Proof:** fake timers; spec 6.3 table.

### 4.10 `gestures/useTapGestures.ts`
- **Interface:** `export function useTapGestures(input: { commands: PlaybackCommands; onInteraction(): void; onToggleControls(): void; layout: { width: number; height: number }; enabled: boolean; haptics: HapticsAdapter; onSkipFeedback(direction: "back" | "forward"): void; onLongPressRate(active: boolean): void }): GestureType` (a composed RNGH gesture to pass to `GestureDetector`).
- **Proof:** `fireGestureHandler` tests for each zone and the long press.

### 4.11 `gestures/useSwipeGestures.ts`
- **Interface:** `export function useSwipeGestures(input: { commands: PlaybackCommands; brightness: BrightnessAdapter; layout; enabled: boolean; onLevel(kind: "brightness" | "volume", level: number | null): void; initialVolume: number }): GestureType`.
- **Proof:** deltas and halves.

### 4.12 `ui/PlayerSurface.tsx`
- **Interface:** `export const PlayerSurface = forwardRef<VideoView, { player: VideoPlayer; posterUrl?: string; showPoster: boolean; contentFit: "contain"; allowsPictureInPicture: boolean; onPictureInPictureStart(): void; onPictureInPictureStop(): void; onLayout(e: LayoutChangeEvent): void; children: ReactNode; testID?: string }>`.
- **Depends on:** `expo-video` `VideoView` (R3 exception), `expo-image`.
- **Proof:** renders `VideoView` with `nativeControls={false}`, `allowsFullscreen={false}`; poster toggles.

### 4.13 `ui/ControlsOverlay.tsx`
- **Interface:** `{ snapshot: PlaybackSnapshot; commands: PlaybackCommands; visibility: ReturnType<typeof useControlsVisibility>; layoutMode: "inline" | "fullscreen"; hasNext; hasPrevious; isAutoplayNextEnabled; onNext; onPrevious; onToggleAutoplayNext; onToggleFullscreen; onToggleMinimize; onOpenSettings; onPip; pipSupported: boolean; chapters?; captionsEnabled: boolean; insets: EdgeInsets }`.
- **Responsibility:** layout only; no state; no timers.
- **Proof:** snapshot-driven render tests per row.

### 4.14 `ui/controls/ControlButton.tsx`
- **Interface:** spec 6.5.
- **Proof:** label, role, disabled state, hitSlop for `sm`, press calls `onPress` once.

### 4.15 `Player.tsx` (composition root)
- See section 5.

### 4.16 `components/Video/VideoPlaybackContainer.tsx` (after the swap)
- **Interface:** `VideoPlaybackContainerProps` as today plus `readonly isFullscreen: boolean` (so it can hide the action bar) — the screen already tracks this.
- **Responsibility:** map `Video` + `PlayableSource` → `VideoPlayerProps`; choose `file://` when downloaded; render `VideoActionBar`; track `video_start`/`video_finish` as today; forward `onPositionChange` to the app's later persistence hook (for now: analytics only, `track("video_progress", { videoId, positionMs })` at most once per minute via the same cadence).
- **Must not:** read engine internals; call the network.
- **Proof:** `__tests__/components/VideoPlaybackContainer.test.tsx` with a mocked player: prop mapping table, `file://` preference, action bar hidden in fullscreen and minimized.

### 4.17 `components/Video/actions/*` and `services/videoActions/*`
- See `07-app-actions-and-repositories.md`.

## 5. Composition root (`Player.tsx`) — the wiring order

```tsx
export function Player(props: VideoPlayerProps) {
  // 1. Engine
  const { snapshot, commands, player, notifyPictureInPicture } = usePlaybackEngine(props.source, {
    autoplay: props.autoplay ?? true, loop: false, mutedByDefault: false,
    initialPositionMs: props.initialPositionMs, timeUpdateIntervalMs: TIME_UPDATE_INTERVAL_MS,
  });

  // 2. Layout + platform
  const [layoutMode, setLayoutMode] = useLayoutMode(props.isMinimized);          // "inline" | "fullscreen" | "minimized"
  const fullscreen = useFullscreen({ onChange: props.onFullscreenChange, setLayoutMode }); // wraps fullscreenAdapter, orientationAdapter, systemChromeAdapter, BackHandler
  const [surfaceLayout, onSurfaceLayout] = useSurfaceLayout();                    // width/height from onLayout
  const insets = useSafeAreaInsets();

  // 3. Transient UI state
  const toast = useToast();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [swipeLevel, setSwipeLevel] = useState<{ kind; level } | null>(null);

  // 4. Gestures + visibility
  const visibility = useControlsVisibility({ status: snapshot.status, isSheetOpen, isMinimized: layoutMode === "minimized" });
  const tapGesture = useTapGestures({ commands, onInteraction: visibility.onInteraction, onToggleControls: …, layout: surfaceLayout, enabled: gesturesEnabled, haptics: hapticsAdapter, onSkipFeedback, onLongPressRate });
  const swipeGesture = useSwipeGestures({ commands, brightness: brightnessAdapter, layout: surfaceLayout, enabled: gesturesEnabled, onLevel: setSwipeLevel, initialVolume: snapshot.volume });
  useKeyboardShortcuts({ commands, fullscreen, setCaptionsEnabled, snapshot });   // web adapter; native no-op

  // 5. Outbound callbacks
  useOnStateChange(snapshot, props.onStateChange);                               // latest-ref pattern (S18)
  useEndScreenCountdown({ snapshot, hasNext: props.hasNext, enabled: props.isAutoplayNextEnabled, onFinished: props.onFinished });

  // 6. Render
  return (
    <View style={layoutStyles[layoutMode]} testID={props.testID}>
      <GestureDetector gesture={Gesture.Simultaneous(tapGesture, swipeGesture)}>
        <PlayerSurface ref={videoViewRef} player={player} posterUrl={props.source.posterUrl} showPoster={!hasPlayedRef.current} … onLayout={onSurfaceLayout}>
          {layoutMode === "minimized"
            ? <MiniPlayer snapshot={snapshot} commands={commands} onRestore={props.onToggleMinimize} onClose={props.onToggleMinimize} />
            : <ControlsOverlay … />}
          {captionsEnabled && props.captions ? <CaptionsView captions={props.captions} positionMs={snapshot.positionMs} /> : null}
          <BufferingIndicator status={snapshot.status} />
          <ErrorCard error={snapshot.error} retryAttempt={snapshot.retryAttempt} onRetry={commands.retry} />
          <EndScreen … />
          <SwipeIndicator level={swipeLevel} />
          <Toast message={toast.message} />
        </PlayerSurface>
      </GestureDetector>
      <SettingsSheet visible={isSheetOpen} … />
    </View>
  );
}
```

Small private hooks (`useLayoutMode`, `useFullscreen`, `useSurfaceLayout`, `useToast`, `useOnStateChange`, `useEndScreenCountdown`, `useKeyboardShortcuts`) live in `components/VideoPlayer/hooks/` (a fifth folder, added here because they are root-only glue; each under 80 lines). The root stays declarative.

## 6. Shorts migration path (ADR 0011; not executed in this effort)

| `useShortsPlayer` today | Engine equivalent |
|---|---|
| `useVideoPlayer(videoUrl, p => { p.loop = false; p.muted = isMuted })` | `usePlaybackEngine({ url, kind: "mp4", isLive: false }, { autoplay: false, loop: true, mutedByDefault: true, timeUpdateIntervalMs })` |
| `isActive` effect calling `play()`/`pause()` | `useEffect(() => isActive ? commands.play() : commands.pause(), [isActive])` |
| `isPlaying` | `snapshot.status === "playing"` |
| `isLoading` | `snapshot.status === "loading" \|\| "buffering"` |
| `error: string \| null` | `snapshot.error?.message ?? null` |
| `progress` (0..1) | `snapshot.durationMs ? snapshot.positionMs / snapshot.durationMs : 0` |
| `duration` | `snapshot.durationMs / 1000` |
| `seek(seconds)` | `commands.seekTo(seconds * 1000)` |
| `retry()` | `commands.retry()` |
| `onEnded` | effect on `snapshot.status === "ended"` (with `loop: true`, native loops; `playToEnd` still fires) |
| mute prop change | `useEffect(() => commands.setMuted(isMuted), [isMuted])` |

Open question for that later increment: with many `ShortCard`s mounted in a list, each with an engine, the app must ensure only the focused one plays (today each card manages this via `isActive`). The engine does not coordinate across instances by design.

## 7. What the container must never do

- Read `snapshot` fields to make UI decisions inside the player's area (the player owns its UI).
- Pass any callback that reaches into the engine (no `getPlayer()` escape hatch exists).
- Render anything between the player and the action bar that depends on playback state other than `isFullscreen`/`isMinimized`.
