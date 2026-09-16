# Video Player Redesign — Design Specification

| Field | Value |
|---|---|
| Date | 2026-09-16 |
| Status | Approved in brainstorming session; awaiting written-spec review |
| Scope | `components/VideoPlayer/` rebuild, app-action relocation to `components/Video/actions/`, new `services/videoActions/` |
| Out of scope | Any change to `components/Shorts/`; any backend implementation; native code or ejecting Expo |
| Supersedes | HLD `2026-09-15-yagna-mobile-hld-design.md` section M items 1, 2, 3, 5, 6, 7 (item 4 partially: engine designed for Shorts, migration deferred; item 8 unchanged) |
| Stack (pinned) | Expo SDK 54.0.22, React Native 0.81.4, React 19.1.0, expo-video ~3.0.11, react-native-reanimated ~4.1.1, react-native-gesture-handler ~2.28.0, TypeScript ~5.9.2 strict |
| Audience | Implementers using less capable models. Every section states what to build, what it depends on, and how to prove it. Nothing here is optional unless marked "later". |

---

## 0. How to read this document

- Section 1 explains why the work exists and what the current player does wrong, with evidence.
- Section 2 lists the decisions the human approved. Do not re-open them.
- Sections 3 to 9 are the design. Each module has a **Responsibility**, **Interface**, **Depends on**, and **Proof** (how a test shows it works).
- Section 10 is the migration order. Section 11 is the documentation set that follows this spec. Section 12 lists open items that need the human.
- Terms in **bold** on first use are defined in the glossary (section 13).
- File paths are relative to the repository root `D:\expo-live-player`.
- "Player" means the code under `components/VideoPlayer/`. "App" means everything else. "Container" means `components/Video/VideoPlaybackContainer.tsx`.

---

## 1. Context and problem statement

### 1.1 Where the player sits today

- The Yagna mobile app (screens under `app/`, state in `contexts/`, data in `services/`) is built and tested (375 Jest tests passing in the `.worktrees/mvp-implementation` checkout as of 2026-09-16).
- Exactly one production module imports the player: `components/Video/VideoPlaybackContainer.tsx`. It maps a domain `Video` and a resolved `PlayableSource` onto the player's 20 props and lifts two events (`onVideoFinished`, `onFullscreenChange`). This single choke point is what makes a rebuild safe.
- Increment 0B (commits `44503c4` to `9397f42`) already removed 11 unreachable files to `docs/history/videoplayer/`, fixed a temporal-dead-zone crash, typed the four metadata props, and put unverified actions behind `PLAYER_FEATURE_FLAGS` in `constants/config.ts`. The player has zero TypeScript errors of its own.

### 1.2 Verified defects in the current player (evidence gathered 2026-09-16)

These are the reasons for a rebuild rather than a patch. The full register with severities lives in `docs/player/01-current-player-issue-register.md`.

| # | Defect | Evidence | Consequence |
|---|---|---|---|
| D1 | Composition root is 1,111 lines and mixes eight concerns | `components/VideoPlayer/index.tsx` | Unreviewable; every change risks every feature |
| D2 | Three independent 250 ms polling intervals read `player.playing`/`player.duration` | `index.tsx` (2 intervals), `usePlayPauseController.ts:106`, `hooks/useVideoProgress.ts:122` | 12 timer ticks per second, 3 state copies, state drift, battery cost; expo-video already emits `statusChange`, `playingChange`, `timeUpdate`, `playToEnd` |
| D3 | "Buffered" value is faked as the current position | `hooks/useVideoProgress.ts` comment "use currentTime as buffered estimate" | Progress bar lies; `player.bufferedPosition` exists and is unused |
| D4 | End-of-video detected by `currentTime >= duration - 0.1` every 250 ms | `index.tsx` `checkFinished` | Fires repeatedly; `playToEnd` event exists |
| D5 | Fullscreen renders a second `Modal`, remounting `VideoView`; position restored via `setTimeout(200)` | `index.tsx` `handleToggleFullscreen` | Black flash, position jump, race with buffering, double-tap seek after remount |
| D6 | Approximately 150 lines of diagnostic `Logger.info` effects fire on every dimension change | `index.tsx` "white_panel_height_reduced_50_percent" and siblings | Render-time work, log spam, dead documentation-as-code |
| D7 | Previous and Next buttons are near-duplicates | `PreviousVideoButton.tsx` (229 lines) vs `NextVideoButton.tsx` (228 lines), 211-line diff of renamed identifiers | Two places to fix every bug |
| D8 | Three animation stacks in one folder | RN `Animated` (6 files), Reanimated (`VideoActionButton`, `VideoDownloadModal`), `react-native-paper` `IconButton` (`AutoplayToggle`, `FullscreenButton`) | Inconsistent motion, extra bundle, `react-native-paper` used nowhere else in the app |
| D9 | Action hook talks to an in-memory mock with fake network delays | `services/videoActionsService.ts` `simulateNetworkDelay`, `mockVideoState` | State lost on restart; labelled "production-ready" in its header |
| D10 | No playback error state, no buffering indicator, no retry, no offline handling | `index.tsx` `onVideoError` only logs and shows controls | User sees a black box on failure |
| D11 | No background handling; no resume position; no source-change handling | No `AppState` subscription; `useVideoPlayer(sourceUrl)` recreates the native player per URL | Audio continues in background on some devices; position lost on rotate-to-fullscreen and on return |
| D12 | Web-only fullscreen and keyboard code with `document as any` | `index.tsx` lines ~370 to ~470 | Untyped, unguarded on native, no test |
| D13 | `any` in gesture code and controller logger | `index.tsx` `(evt.nativeEvent as any)`, `usePlayPauseController.ts:66` | Violates strict-TypeScript rule |
| D14 | Double-tap detection uses `clientWidth` (a DOM property) with a `400` fallback | `index.tsx` `onVideoAreaPress` | Left/right detection is wrong on native |
| D15 | Controls visibility state duplicated between `usePlayPauseController` (`isPlaying`, `isLoaded`) and `index.tsx` (`isPlaying`, `isLoaded`) | both files | Two sources of truth |
| D16 | Player imports app concerns: `useVideoActions` (hooks), `useSaved` (contexts), `shareLinkService`, `PLAYER_FEATURE_FLAGS` | `index.tsx`, `modals/VideoSaveSheet.tsx`, `modals/VideoShareSheet.tsx`, `VideoActionBar.tsx` | Player cannot be reused by Shorts or tested without app providers |
| D17 | Captions and chapters are accepted as `any` and never rendered | `Props.captions?: any; chapters?: any` | Feature advertised by the type, absent at runtime |
| D18 | Minimize button exists; no mini-player view exists | `MinimizeButton.tsx`, `index.tsx` hides bars when `isMinimized` | Button with no destination |
| D19 | Magic numbers throughout (`0.304`, `3000`, `3500`, `220`, `9999`, `10000`) | `index.tsx`, `usePlayPauseController.ts` | Violates constants rule |
| D20 | Main checkout `node_modules` lacks `@testing-library/react-native` | `ls node_modules/@testing-library` → not found; `tsc` reports 31 `TS2307` in `__tests__` | `npm test` cannot run in the main checkout until `npm install` |

### 1.3 Goals

1. A player that is **lean** (composition root under 200 lines, no duplicate controls, one animation library, no dead code), **fast** (event-driven, bounded re-renders, UI-thread animations, measured against targets in section 8), and **robust** (explicit state machine, every failure path handled, no leaked resources) on low-end Android, iOS, and web.
2. A player that is **app-agnostic** so the same engine can later serve Shorts.
3. All Tier 1, 2 and 3 features (section 5) delivered or deliberately stubbed behind an interface with no fake success.
4. Documentation detailed enough for a less capable model to implement each unit without inventing behaviour.

### 1.4 Non-goals

- Changing `components/Shorts/` (design for it, do not touch it).
- Implementing any backend, payment provider, or offline-HLS download.
- Changing Expo SDK, React Native, or expo-video versions.
- Changing screens, navigation, `PlayQueueContext`, `SavedContext`, or `SettingsContext` beyond what the container swap needs.

---

## 2. Approved decisions

Each is recorded as an ADR in `docs/player/adr/`. Summaries:

| ADR | Decision | Why |
|---|---|---|
| 0001 | **Parallel rebuild behind the container, then swap** (Approach 2). New code is built in new subfolders of `components/VideoPlayer/`; old flat files stay live and untouched until the swap. | Single consumer makes the swap one line with a one-commit rollback. Each task is "build a unit to an interface", which smaller models do reliably. The old polling core and `Modal` fullscreen are not salvageable by incremental edits. |
| 0002 | **Event-driven engine with a pure reducer.** No polling. State derives from expo-video events. | Removes D2, D3, D4, D15; makes state testable without native modules. |
| 0003 | **Reanimated 4 is the only animation library in the player.** RN `Animated` and `react-native-paper` leave the player. `react-native-paper` stays in `package.json` until a separate removal decision because dependency changes need their own ADR. | Removes D8; UI-thread animations for control fades. |
| 0004 | **In-place fullscreen, no `Modal`.** The composition root switches layout; `VideoView` never unmounts. | Removes D5. |
| 0005 | **Full web parity** via platform adapters with `.native.ts`/`.web.ts` files. No `Platform.OS` above the adapter layer. | Human decision; contains platform branching to one layer. |
| 0006 | **App actions leave the player.** Action bar, sheets, and `useVideoActions` move to `components/Video/actions/`. | Removes D16; player becomes reusable. |
| 0007 | **Repository pattern for app actions** with one local (AsyncStorage) implementation now and a backend implementation later. Backend platform is unknown (AWS, Azure, or other). | Ships working state today without inventing a backend. |
| 0008 | **Download via `expo-file-system` for MP4 only.** HLS download is out of scope; the button hides for HLS. | expo-video exposes no offline-HLS API; MP4 download works without a backend. |
| 0009 | **Thanks is UI-complete against a `PaymentProvider` interface** with a single `unavailablePaymentProvider` that shows "coming soon". No fake success. | Human wants the flow built now, backend later. |
| 0010 | **Add `expo-brightness`** (SDK 54 line, installed via `npx expo install expo-brightness`) for the brightness swipe gesture. Only new dependency. | Human approved. |
| 0011 | **Shorts readiness without Shorts changes.** Engine options `{ loop, mutedByDefault, autoplay }` and UI-independent commands are verified against `hooks/useShortsPlayer.ts` needs; migration is a documented later increment. | Approach C from the brainstorming session. |
| 0012 | **Device and performance targets proposed, pending human confirmation** (section 8). | Human deferred the question. Implementers measure against the proposed table until told otherwise. |

---

## 3. Architecture

### 3.1 Layering and dependency direction

```
┌─────────────────────────────────────────────────────────────────┐
│ app/ screens                                                    │
│   └─ components/Video/VideoPlaybackContainer.tsx (only importer │
│        of the player) + components/Video/actions/*              │
│        depends on: contexts/, services/, hooks/, types/domain   │
└───────────────┬─────────────────────────────────────────────────┘
                │ props + callbacks only (section 3.3)
┌───────────────▼─────────────────────────────────────────────────┐
│ components/VideoPlayer/index.tsx   composition root             │
│   depends on: engine/, platform/, gestures/, ui/, constants     │
├─────────────────────────────────────────────────────────────────┤
│ ui/  gestures/      presentational + gesture hooks              │
│   depend on: engine/types, constants, tokens, reanimated, RNGH  │
│   never import: expo-video, expo-screen-orientation, Platform   │
├─────────────────────────────────────────────────────────────────┤
│ platform/           device capability adapters                  │
│   depend on: expo-screen-orientation, expo-brightness,          │
│              react-native StatusBar, DOM (web files only)       │
├─────────────────────────────────────────────────────────────────┤
│ engine/             headless playback                           │
│   depends on: expo-video only (PlaybackEngine.ts and            │
│              usePlaybackEngine.ts import it), pure TS elsewhere │
└─────────────────────────────────────────────────────────────────┘
```

Rules (each enforced by a Jest invariant test in `__tests__/player/invariants.test.ts` that greps the source tree):

| Rule | Check |
|---|---|
| R1 Only the container imports the player | `grep -rn "components/VideoPlayer" app components --include=*.tsx \| grep -v VideoPlaybackContainer \| grep -v "^components/VideoPlayer/"` → empty |
| R2 Player imports no app code | `grep -rn "from \"\.\./\.\./\(contexts\|services\|hooks\|app\)" components/VideoPlayer` → empty (also `@/contexts` etc.) |
| R3 Only the engine folder and the surface import expo-video | `grep -rln "from \"expo-video\"" components/VideoPlayer` → exactly three files: `engine/PlaybackEngine.ts` (player methods and events), `engine/usePlaybackEngine.ts` (`useVideoPlayer` only), `ui/PlayerSurface.tsx` (`VideoView` only; see 3.2) |
| R4 No `Platform.OS` above platform/ | `grep -rn "Platform\.OS\|Platform\.select" components/VideoPlayer --include=*.ts* \| grep -v "/platform/"` → empty |
| R5 No RN `Animated` or paper in the player | `grep -rn "from \"react-native-paper\"\|Animated\." components/VideoPlayer \| grep -v reanimated` → empty |
| R6 No `any` in the player | `grep -rn ": any\|as any\|<any>" components/VideoPlayer` → empty |
| R7 Shorts untouched | `git diff --stat main -- components/Shorts hooks/useShortsPlayer.ts` → empty at every increment |

### 3.2 Exception to R3

`ui/PlayerSurface.tsx` must render expo-video's `VideoView` and hold its ref for picture-in-picture. It imports only `VideoView` and the `VideoView` type from expo-video and receives the `VideoPlayer` instance as a prop from the composition root. It never calls a method on the player.

### 3.3 Public API of the player (after the swap)

`components/VideoPlayer/types.ts`:

```ts
import type { CaptionItem, ChapterItem } from "../../types/domain"; // type-only import is permitted (R2 applies to runtime imports)

export interface VideoPlayerSource {
  readonly url: string;                 // https:// or file:// (downloaded MP4)
  readonly kind: "hls" | "mp4";
  readonly isLive: boolean;             // declared by the app; engine also reads player.isLive
  readonly posterUrl?: string;
  readonly headers?: Readonly<Record<string, string>>; // never logged
}

export interface VideoPlayerProps {
  readonly source: VideoPlayerSource;
  readonly title: string;               // for accessibility labels and now-playing metadata
  readonly captions?: readonly CaptionItem[];
  readonly chapters?: readonly ChapterItem[];
  readonly autoplay?: boolean;          // default true
  readonly initialPositionMs?: number;  // resume; ignored for live
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayNextEnabled: boolean;
  readonly isMinimized: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onFinished: () => void;                          // fires once when the end-screen countdown completes (autoplay-next on and hasNext true); never fires otherwise
  readonly onToggleMinimize: () => void;
  readonly onToggleAutoplayNext: (enabled: boolean) => void;
  readonly onFullscreenChange: (isFullscreen: boolean) => void;
  readonly onPositionChange: (positionMs: number, durationMs: number) => void; // every 5 s while playing, and on pause/seek/end/unmount
  readonly onStateChange: (snapshot: PlaybackSnapshot) => void;              // every snapshot change; for analytics and error reporting
  readonly testID?: string;
}
```

Removed from today's surface: `buttonSize`, `hideControlsTimeout`, `theme` (no consumer passes them), `sourceUrl`/`videoUrl`/`videoId`/`videoTitle`/`channelId` (folded into `source` and `title`; ids belong to the action bar, which is now the container's child). During the build, the old `index.tsx` and its 20 props stay exactly as they are. The container changes only in the swap task (section 10, step S2).

### 3.4 Composition root responsibilities (`index.tsx`, target under 200 lines)

1. Call `usePlaybackEngine(source, { autoplay, initialPositionMs, loop: false, mutedByDefault: false })` → `{ snapshot, commands, player }`.
2. Call `useFullscreen(...)`, `useControlsVisibility(snapshot)`, `useTapGestures(commands, visibility)`, `useSwipeGestures(commands)`, `useKeyboardShortcuts(commands, fullscreen)` (web no-op).
3. Forward `snapshot` to `onStateChange` in an effect; forward position to `onPositionChange` on the schedule in 3.3.
4. Choose layout mode: `"inline" | "fullscreen" | "minimized"`.
5. Render `<PlayerSurface>` with `<ControlsOverlay>` (or `<MiniPlayer>` when minimized) and the transient views (`BufferingIndicator`, `ErrorCard`, `EndScreen`, `Toast`, `CaptionsView`, `SettingsSheet`).
6. Nothing else. No styles beyond layout mode selection, no logging beyond one dev-only line per state change, no timers of its own. Root-only glue hooks (`useLayoutMode`, `useFullscreen`, `useSurfaceLayout`, `useToast`, `useOnStateChange`, `useEndScreenCountdown`, `useKeyboardShortcuts`) live in `components/VideoPlayer/hooks/`, each under 80 lines, importing only from `engine/`, `platform/` and `constants.ts`.

---

## 4. Playback engine (`components/VideoPlayer/engine/`)

### 4.1 Types (`engine/types.ts`)

```ts
export type PlaybackStatus =
  | "idle"       // no source, or disposed
  | "loading"    // source set, first frame not ready
  | "ready"      // ready to play, not playing (initial or after load with autoplay=false)
  | "playing"
  | "paused"
  | "buffering"  // was playing, stalled waiting for data
  | "ended"
  | "error";

export type PlaybackErrorCode = "network" | "unsupported" | "expired" | "decode" | "unknown";

export interface PlaybackError {
  readonly code: PlaybackErrorCode;
  readonly message: string;        // user-safe, from ERROR_MESSAGES in constants.ts
  readonly retryable: boolean;     // false for "unsupported"
  readonly cause?: string;         // raw native message, for Logger only, URL query strings stripped
}

export interface QualityTrack {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly bitrate: number | null;
  readonly label: string;          // "1080p", "720p", derived from height
}

export interface SubtitleTrackInfo {
  readonly id: string;
  readonly language: string;
  readonly label: string;
}

export interface PlaybackSnapshot {
  readonly status: PlaybackStatus;
  readonly positionMs: number;
  readonly durationMs: number;         // 0 when unknown or live
  readonly bufferedMs: number;         // from player.bufferedPosition * 1000
  readonly isLive: boolean;
  readonly liveOffsetMs: number | null; // from player.currentOffsetFromLive * 1000 when live
  readonly playbackRate: number;
  readonly muted: boolean;
  readonly volume: number;             // 0..1
  readonly error: PlaybackError | null;
  readonly retryAttempt: number;       // 0 when not retrying
  readonly qualities: readonly QualityTrack[];
  readonly activeQuality: QualityTrack | null; // null means auto
  readonly subtitleTracks: readonly SubtitleTrackInfo[];
  readonly activeSubtitle: SubtitleTrackInfo | null;
  readonly isPictureInPicture: boolean;
  readonly isPlayingBeforeBackground: boolean; // internal flag surfaced for tests
}

export type EngineEvent =
  | { type: "sourceSet"; isLive: boolean }
  | { type: "statusChange"; status: "idle" | "loading" | "readyToPlay" | "error"; error?: PlaybackError }
  | { type: "playingChange"; isPlaying: boolean }
  | { type: "timeUpdate"; positionMs: number; bufferedMs: number; durationMs: number; liveOffsetMs: number | null }
  | { type: "playToEnd" }
  | { type: "rateChange"; rate: number }
  | { type: "mutedChange"; muted: boolean }
  | { type: "volumeChange"; volume: number }
  | { type: "qualitiesChange"; qualities: readonly QualityTrack[]; active: QualityTrack | null }
  | { type: "subtitlesChange"; tracks: readonly SubtitleTrackInfo[]; active: SubtitleTrackInfo | null }
  | { type: "pipChange"; active: boolean }
  | { type: "stall" }                   // derived: playing, no timeUpdate for STALL_TIMEOUT_MS
  | { type: "retryScheduled"; attempt: number }
  | { type: "appBackground" }
  | { type: "appForeground" }
  | { type: "disposed" };

export interface PlaybackCommands {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekTo(positionMs: number): void;
  seekBy(deltaMs: number): void;
  setRate(rate: number): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  selectQuality(track: QualityTrack | null): void;     // null = auto
  selectSubtitle(track: SubtitleTrackInfo | null): void;
  goToLive(): void;
  retry(): void;
  replay(): void;
}

export interface EngineOptions {
  readonly autoplay: boolean;
  readonly loop: boolean;                // Shorts will pass true
  readonly mutedByDefault: boolean;      // Shorts will pass true
  readonly initialPositionMs?: number;
  readonly timeUpdateIntervalMs: number; // default 250 from constants
}
```

### 4.2 Reducer (`engine/playbackReducer.ts`) — pure, no imports except types

`export function playbackReducer(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot`

Full transition table. Cells marked "—" mean the event is ignored (snapshot returned unchanged, one `console.warn` in `__DEV__` listing state and event). Fields not mentioned are carried over.

| Current status | sourceSet | statusChange loading | statusChange readyToPlay | statusChange error | playingChange true | playingChange false | timeUpdate | playToEnd | stall | appBackground | appForeground | disposed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | → loading, reset position/duration/buffered/error/retryAttempt, set isLive | → loading | — | → error | — | — | — | — | — | — | — | idle |
| loading | → loading (new source) | — | → ready (autoplay handled by engine, not reducer) | → error | → playing | — | update fields, stay | — | — | stay, set isPlayingBeforeBackground=false | — | idle |
| ready | → loading | — | — | → error | → playing | — | update fields | → ended | — | stay | — | idle |
| playing | → loading | → buffering | — | → error | — | → paused | update fields; if durationMs 0 and isLive false and duration now known, set it | → ended | → buffering | → paused, isPlayingBeforeBackground=true | — | idle |
| paused | → loading | — | — | → error | → playing | — | update fields | → ended | — | stay, isPlayingBeforeBackground=false | stay paused (no auto-resume; see 4.4 rule L4) | idle |
| buffering | → loading | — | → buffering | → error | → playing | → paused | update fields; if bufferedMs > positionMs + MIN_BUFFER_AHEAD_MS → playing | → ended | — | → paused, isPlayingBeforeBackground=true | — | idle |
| ended | → loading | — | — | → error | → playing (replay) | — | update position only | — | — | stay | — | idle |
| error | → loading, error=null, retryAttempt=0 | → loading (retry path, keep retryAttempt) | — | → error (replace error) | — | — | — | — | — | stay | — | idle |

Other events in any status except `idle`/`disposed`: `rateChange`, `mutedChange`, `volumeChange`, `qualitiesChange`, `subtitlesChange`, `pipChange`, `retryScheduled` update their fields and keep status. In `idle` they are "—".

Invariants asserted by tests after every transition:
- `positionMs >= 0`; when `durationMs > 0`, `positionMs <= durationMs`.
- `bufferedMs >= positionMs` or `bufferedMs === 0`.
- `error !== null` if and only if `status === "error"`.
- `retryAttempt <= MAX_RETRIES`.

### 4.3 Retry policy (`engine/retryPolicy.ts`) — pure

```ts
export const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const; // in constants.ts, re-exported
export function nextRetryDelayMs(attempt: number, error: PlaybackError): number | null
```
Returns `null` when `!error.retryable` or `attempt >= RETRY_DELAYS_MS.length`, else `RETRY_DELAYS_MS[attempt]`. Attempt is zero-based.

Error classification (`engine/classifyError.ts`, pure): maps an expo-video `PlayerError.message` to a `PlaybackErrorCode` by a fixed ordered list of case-insensitive substrings (`"403"`, `"401"`, `"expired"` → expired; `"unsupported"`, `"codec"`, `"format"`, `"mime"` → unsupported; `"network"`, `"timed out"`, `"timeout"`, `"connection"`, `"host"`, `"unreachable"`, `"-1009"`, `"-1001"`, `"ENOTFOUND"` → network; `"decode"`, `"decoder"` → decode; anything else → unknown). The user-safe message comes from `ERROR_MESSAGES[code]` in `constants.ts`. The `cause` field is the raw message with any `?...` query string removed. Tests cover every substring and the fallback.

### 4.4 Engine class (`engine/PlaybackEngine.ts`) — the only runtime importer of `expo-video` besides `PlayerSurface`

```ts
export class PlaybackEngine {
  constructor(player: VideoPlayer, options: EngineOptions, onSnapshot: (s: PlaybackSnapshot) => void)
  readonly commands: PlaybackCommands;
  getSnapshot(): PlaybackSnapshot;
  setSource(source: VideoPlayerSource, startMs?: number): void;
  notifyAppState(state: "active" | "background" | "inactive"): void;
  notifyPictureInPicture(active: boolean): void;
  dispose(): void;
}
```

Behaviour rules (each has a test in `__tests__/player/engine/PlaybackEngine.test.ts` using the scripted fake player in `__tests__/player/fakes/fakeVideoPlayer.ts`):

- **E1 Subscriptions.** On construction, subscribe to `statusChange`, `playingChange`, `timeUpdate`, `playToEnd`, `sourceChange`, `sourceLoad` (carries `duration`), `playbackRateChange`, `mutedChange`, `volumeChange`, `videoTrackChange`, `availableSubtitleTracksChange`, `subtitleTrackChange` (12 events). Store every returned subscription in one `disposables: Array<{ remove(): void }>`. `dispose()` calls `player.pause()`, removes every subscription, clears the stall, retry and load-timeout timers, and dispatches `disposed` (status `idle`). The engine never calls `player.release()`: the hook created the player with `useVideoPlayer` and that hook's own cleanup releases it. `disposables.length === 0` after dispose is asserted.
- **E2 Setup.** `player.timeUpdateEventInterval = options.timeUpdateIntervalMs / 1000`; `player.loop = options.loop`; `player.muted = options.mutedByDefault`; `player.keepScreenOnWhilePlaying = true`; `player.staysActiveInBackground = false`; `player.showNowPlayingNotification = false` (revisit later); `player.preservesPitch = true`.
- **E3 Source.** `setSource` dispatches `sourceSet`, calls `player.replace({ uri, headers, contentType: kind === "hls" ? "hls" : "auto" })`, then if `startMs` (or `options.initialPositionMs` on first source) is > 0 and not live, seeks after the first `readyToPlay`. If `options.autoplay`, calls `player.play()` after the first `readyToPlay`. Headers are never logged.
- **E4 Stall detection.** When status is `playing`, a timer of `STALL_TIMEOUT_MS` (2,000) restarts on every `timeUpdate`. If it fires, dispatch `stall`. When status leaves `playing`, clear it.
- **E5 Buffering exit.** On `timeUpdate` while `buffering`, the reducer moves back to `playing` when `bufferedMs > positionMs + MIN_BUFFER_AHEAD_MS` (500) or when `player.playing` is true and position advanced since the last update.
- **E6 Errors and retry.** On `statusChange error`: classify, dispatch `statusChange` with the `PlaybackError`, then compute `nextRetryDelayMs(retryAttempt, error)`. If a delay exists, dispatch `retryScheduled` (attempt + 1), start a timer, and on fire call `player.replace(sameSource)` then seek to the last known position once ready. If `null`, stay in `error` until `commands.retry()` (which resets `retryAttempt` to 0 and repeats the source set) or `setSource`. A `setSource` or `dispose` during the timer cancels it.
- **E7 Commands.** Each command validates then calls the player: `seekTo` clamps to `[0, durationMs]` when VOD, to `[positionMs - liveWindowMs, positionMs]` when live (liveWindowMs = `player.duration * 1000` if finite, else 0 → seek disabled); `setRate` accepts only values in `PLAYBACK_RATES`; `setVolume` clamps `[0, 1]`; `selectQuality` is **not implementable in expo-video 3.0.11**: `videoTrack` and `availableVideoTracks` are read-only (verified in `node_modules/expo-video/build/VideoPlayer.types.d.ts` lines 189 and 198) and adaptive bitrate is chosen by the native player. The command exists in the interface for forward compatibility, is a no-op that logs once in dev, and the snapshot's `activeQuality` reports the current track read-only (see F24); `selectSubtitle` sets `player.subtitleTrack`; `goToLive` sets `player.currentTime` to the live edge (`player.currentLiveTimestamp` path or `seekBy(Number.MAX_SAFE_INTEGER)` fallback) and `player.targetOffsetFromLive = 0`; `replay` calls `player.replay()`. In `idle`, `loading`, or `error`, every command except `retry` is a no-op with a dev warning. `retry` is a no-op unless status is `error`.
- **E8 App state.** `notifyAppState("background" | "inactive")` when `playing` or `buffering`: call `player.pause()` and dispatch `appBackground`. `notifyAppState("active")`: dispatch `appForeground`; **rule L4**: the engine does not auto-resume. The UI shows the play button; the user resumes. (Rationale: auto-resume plays audio unexpectedly after calls and lock-screen visits. Later option for the app: pass `resumeOnForeground` in options.)
- **E9 Position reporting.** The hook (not the engine) implements the 5 s cadence for `onPositionChange` using the snapshot stream; the engine only publishes snapshots.
- **E10 Snapshot publication.** `onSnapshot` is called only when the reducer returns a different object (reference inequality). The reducer returns `prev` unchanged for ignored events, so no re-render happens.

### 4.5 React binding (`engine/usePlaybackEngine.ts`)

```ts
export function usePlaybackEngine(source: VideoPlayerSource, options: EngineOptions): {
  snapshot: PlaybackSnapshot;
  commands: PlaybackCommands;
  player: VideoPlayer;            // passed to PlayerSurface only
  notifyPictureInPicture(active: boolean): void;
}
```

- Creates the expo-video player with `useVideoPlayer(null)` once (source `null`), constructs one `PlaybackEngine` in a `useRef`, and publishes snapshots via `useSyncExternalStore` so React batches and de-duplicates.
- `useEffect([source.url, source.kind, source.isLive])` → `engine.setSource(source, positionToKeep)`, where `positionToKeep` is the last position only if the URL is unchanged (re-render with the same URL must not restart the video).
- `useEffect([])` → `AppState.addEventListener("change", engine.notifyAppState)`; cleanup removes it, calls `engine.dispose()`, and the expo-video player is released by `useVideoPlayer`'s own cleanup.
- Guarantees, tested with fake timers and a mocked `AppState`: no listener or timer alive after unmount; re-render with identical props causes no player call; URL change causes exactly one `replace`.

### 4.6 Shorts readiness check (no code change in Shorts)

`hooks/useShortsPlayer.ts` needs: loop, muted default, play when focused, pause when unfocused, progress 0..1, duration, error string, retry. Mapping to the engine: `options.loop = true`, `options.mutedByDefault = true`, `commands.play/pause` driven by the focus prop, `snapshot.positionMs / durationMs`, `snapshot.error?.message`, `commands.retry`. All covered without a Shorts-specific method. Recorded in `docs/player/03-architecture.md` section "Shorts migration path" as a later increment.

---

## 5. Features

Each feature has an id (F-number), a tier, the module that owns it, and acceptance criteria. Full criteria with every state (loading, success, empty, invalid, failure, offline, retry, cancel) are in `docs/player/02-feature-catalog.md`. Summary:

### 5.1 Tier 1 — Core

| Id | Feature | Owner module | Acceptance (summary) |
|---|---|---|---|
| F1 | MP4 and HLS playback, VOD and live | engine | Both kinds reach `playing`; `isLive` true for live HLS; `durationMs` 0 for live |
| F2 | Explicit state machine | engine/playbackReducer | Every cell of table 4.2 has a test |
| F3 | Event-driven progress and buffered range | engine | `timeUpdate` drives position; `bufferedMs` equals `player.bufferedPosition * 1000`; no `setInterval` in the player except stall and retry timers |
| F4 | Play, pause, toggle | ui/controls/PlayPauseButton, engine | Button label reflects state; toggle in `ended` replays |
| F5 | Seek: scrub, tap, double-tap skip, keyboard | ui/ProgressBar, gestures/useTapGestures, platform/keyboard | Clamped; preview label during drag; commit on release; live rules per E7 |
| F6 | Mute and volume | ui/controls/MuteButton, gestures | Mute toggles `player.muted`; volume swipe sets 0..1 |
| F7 | Buffering indicator | ui/BufferingIndicator | Visible only in `loading` and `buffering`; replaces the centre play button slot |
| F8 | Error card with retry | ui/ErrorCard, engine retry | Shows `error.message`; automatic retries shown as "Retrying (1/3)"; manual Retry after; Unsupported shows no retry |
| F9 | Fullscreen and orientation, in place | index layout, platform/fullscreen, platform/orientation | `VideoView` instance unchanged (test: same testID node identity); position continuous; landscape locked native; `requestFullscreen` web; back button and Escape exit |
| F10 | Lifecycle | engine/usePlaybackEngine | Background pauses; unmount disposes; source change replaces once; navigation away stops audio |
| F11 | Controls visibility | gestures/useControlsVisibility | Rules in 6.3; hidden controls not tappable |
| F12 | Next, previous, autoplay-next toggle, end screen countdown | ui/controls/SkipButton, AutoplayToggle, ui/EndScreen | Disabled states when no neighbour; toggle calls `onToggleAutoplayNext`; countdown 5 s cancellable then `onFinished` |
| F13 | Safe areas and layout modes | index, ui/PlayerSurface | Inline 16:9 letterbox; fullscreen full window; minimized fixed box; no overlap with system nav |
| F14 | Accessibility | every control | Role, state-aware label, 44x44 hit slop, adjustable progress bar, live region on toast and error |
| F15 | Resume position reporting | usePlaybackEngine + index | `onPositionChange` every 5 s playing, and on pause/seek/end/unmount; `initialPositionMs` applied once after first ready |
| F16 | Poster before first frame | ui/PlayerSurface | `posterUrl` shown until first `ready`; hidden after |

### 5.2 Tier 2 — Complete experience

| Id | Feature | Owner module | Acceptance (summary) |
|---|---|---|---|
| F17 | Playback speed | ui/SettingsSheet, engine | Presets `PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]`; toast "Speed 1.5x"; long-press 2x while held restores prior rate |
| F18 | Captions | ui/CaptionsView, engine | Two sources: (a) `captions` prop cues rendered by `selectCue(captions, positionMs)` (pure, binary search, `start <= pos < (end ?? nextStart)`); (b) embedded tracks via `snapshot.subtitleTracks` and `selectSubtitle`. Toggle and track picker in settings; font follows `PixelRatio.getFontScale()`; hidden when neither source exists |
| F19 | Chapters | ui/ProgressBar, ui/TimeLabel | Markers at `startMs / durationMs`; current chapter title beside time; tap marker seeks; pure `currentChapter(chapters, positionMs)` |
| F20 | Live UI | ui/controls/LiveBadge, GoLiveButton, ProgressBar | Badge when `isLive`; "Go live" visible when `liveOffsetMs > LIVE_EDGE_TOLERANCE_MS` (10,000); progress bar shows window or hides when window is 0 |
| F21 | Picture-in-picture | platform/pictureInPicture, ui/controls/PipButton, PlayerSurface | Native: `VideoView` ref `startPictureInPicture()`, `allowsPictureInPicture`, iOS `startsPictureInPictureAutomatically`; web: `requestPictureInPicture` on the `<video>` element when supported; button hidden when adapter reports unsupported; `pipChange` updates snapshot |
| F22 | Keep screen awake while playing | engine E2 | `player.keepScreenOnWhilePlaying = true`; no `expo-keep-awake` usage needed |
| F23 | Brightness and volume swipe | gestures/useSwipeGestures, platform/brightnessVolume | Left half brightness via `expo-brightness` (permission-free on both platforms for app-window brightness), right half volume via `setVolume`; vertical indicator; disabled when minimized or when controls sheet open |
| F24 | Quality display (manual selection is a later item) | ui/SettingsSheet, engine E7 | Settings shows the current quality label read-only ("Auto · 720p") from `snapshot.activeQuality`; hidden when no track info. Manual selection needs an expo-video version with a writable `videoTrack`; recorded as a later item and `PLAYER_FEATURE_FLAGS.qualitySelection` stays `false` |
| F25 | Mini-player | ui/MiniPlayer | When `isMinimized`: video box `MINI_PLAYER_WIDTH` x 16:9, play/pause, close (calls `onToggleMinimize` then the app decides), tap restores via `onToggleMinimize`; positioning remains the screen's job |
| F26 | Haptics | gestures via platform/HapticsAdapter | Light impact on double-tap seek and scrub release; native uses `expo-haptics` (already installed); web adapter is a no-op |
| F27 | Toast | ui/Toast | 1.5 s auto-dismiss, one at a time, live region |
| F28 | Web keyboard and hover | platform/keyboard.web, index | Space/K play, F fullscreen, M mute, Escape exit, ArrowLeft/Right 5 s, J/L 10 s, 0–9 percent seek, `<`/`>` rate, C captions; hover shows controls; focus ring |

### 5.3 Tier 3 — App actions (outside the player)

| Id | Feature | Owner module | Acceptance (summary) |
|---|---|---|---|
| F29 | Action bar relocation | components/Video/actions/VideoActionBar | Rendered by the container below the player; hidden in fullscreen and minimized; same buttons as today plus Thanks |
| F30 | Like and Dislike | actions/useVideoActions + services/videoActions | Optimistic, rollback on failure, in-flight guard, persisted locally; counts shown only when repository returns them |
| F31 | Save | actions/sheets/SaveSheet + SavedContext | Unchanged behaviour, relocated file |
| F32 | Share | actions/sheets/ShareSheet + shareLinkService | Unchanged behaviour, relocated file |
| F33 | Download (MP4 only) | actions/sheets/DownloadSheet + services/videoActions/downloadService | Resumable download to `documentDirectory/videos/<videoId>.mp4`, progress 0..1, pause/resume/cancel, registry persisted under `STORAGE_KEYS.downloads` (`"yagna.downloads.v1"`, added to `constants/config.ts` alongside `videoActions: "yagna.videoActions.v1"`), badge "Downloaded", delete; the container prefers a `file://` source when registry says complete and file exists; button hidden for HLS |
| F34 | Clip editor | actions/sheets/ClipEditor + repository.createClip | UI as today; `createClip` in the local repository stores `{ videoId, startMs, endMs }` and returns a local id; shows "Saved clip" (no video processing on device); clearly labelled as metadata-only in the UI copy |
| F35 | Report, Not interested, Don't recommend channel | actions/sheets/ReportSheet, OverflowMenu + repository | Persisted locally; idempotent; confirmation toast |
| F36 | Thanks | actions/sheets/ThanksSheet + services/videoActions/PaymentProvider | Presets from provider; full amount-select and confirm UI; only `unavailablePaymentProvider` ships → sheet shows "Thanks is coming soon" state and disables Confirm; no success path without a real provider |
| F37 | Feature flags | constants/config.ts | `PLAYER_FEATURE_FLAGS` remains the kill switch; a flag flips to `true` in the same commit as its passing acceptance tests |
| F38 | Analytics | services/analytics | One `track` per action outcome (`action_like`, `action_download_complete`, …) with `videoId` only |

---

## 6. UI and gestures (`components/VideoPlayer/ui/`, `gestures/`)

### 6.1 Layout modes

| Mode | Container | Video | Chrome |
|---|---|---|---|
| inline (portrait) | width 100%, height `min(window.height * INLINE_MAX_HEIGHT_RATIO, width / ASPECT_16_9)`, black background | `contentFit="contain"` | app status bar visible |
| inline (landscape, not fullscreen) | width 100%, `aspectRatio 16/9` | contain | as app |
| fullscreen | `position: absolute`, inset 0, window size, `zIndex` from tokens | `contentFit="contain"` (never "fill": no stretching) | status bar and Android nav hidden via SystemChromeAdapter; landscape locked; safe-area insets applied to control padding |
| minimized | `MINI_PLAYER_WIDTH` x `MINI_PLAYER_WIDTH * 9/16` | contain | none |

The `VideoView` element is the same React element in every mode (same key, same parent), so it never remounts.

### 6.2 Controls overlay positions

```
┌──────────────────────────────────────────────────────┐
│ [Minimize]        [LIVE]        [Autoplay][PiP][⚙]   │  top row, 12 pt inset + safe area
│                                                      │
│              [Prev]  [Play/Pause|Spinner|Replay]  [Next]   centre row
│                                                      │
│ 00:12 / 04:20  ▓▓▓▓▓▓░░░░░░░░◆░░░░   [Mute] [Full]   │  bottom row
└──────────────────────────────────────────────────────┘
Toast: top centre below top row. Captions: bottom centre above bottom row. Error card: centre, replaces centre row. End screen: centre, replaces centre row. Swipe indicator: vertical bar at left or right third.
```

### 6.3 Controls visibility rules (`gestures/useControlsVisibility.ts`)

| Condition | Visible? |
|---|---|
| First `INITIAL_VISIBLE_MS` (3,000) after mount | yes |
| `playing` and no interaction for `AUTO_HIDE_MS` (3,500) | no |
| `paused`, `ready`, `buffering`, `loading`, `ended`, `error` | yes, always |
| Any tap, gesture, keyboard, or hover | yes, timer restarts |
| Settings sheet open | yes |
| Minimized | not applicable (MiniPlayer has its own two buttons) |

Implementation: one Reanimated `useSharedValue(1)`; `useAnimatedStyle` sets `opacity` and the overlay `pointerEvents` is `"box-none"` when visible and `"none"` when hidden (driven by React state mirrored from the shared value via `runOnJS` after the fade). Fade duration `CONTROLS_FADE_MS` (200). Test: with fake timers, controls hide at 3,500 ms while playing, stay when paused, reappear on tap.

### 6.4 Gestures (`react-native-gesture-handler`)

| Gesture | Zone | Action | Constant |
|---|---|---|---|
| Single tap | anywhere on surface | toggle visibility | `DOUBLE_TAP_WINDOW_MS` 300 decides single vs double via `Gesture.Tap().numberOfTaps(1)` and `.numberOfTaps(2)` with `Gesture.Exclusive` |
| Double tap | left third / right third (by `event.x` vs `layout.width / 3`) | `seekBy(-SKIP_MS)` / `seekBy(+SKIP_MS)`, ripple, label | `SKIP_MS` 10,000 |
| Double tap | centre third | `togglePlay` | |
| Vertical pan | left half | brightness 0..1, delta = `-translationY / layout.height` | `SWIPE_ACTIVATION_PX` 12 |
| Vertical pan | right half | volume 0..1 | |
| Long press | anywhere | rate 2x while held; on release restore previous rate; toast | `LONG_PRESS_MS` 500 |
| Pan on progress bar | bar | scrub; commit on end | |
| Hover (web) | surface | show controls | |

Gestures are disabled when: minimized, settings sheet open, error card shown. Zones are computed from the surface's measured `onLayout`, never from DOM properties.

### 6.5 Control primitive (`ui/controls/ControlButton.tsx`)

```ts
interface ControlButtonProps {
  readonly icon: keyof typeof MaterialCommunityIcons.glyphMap;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly size?: "sm" | "md" | "lg";     // 32, 44, 64 from tokens
  readonly disabled?: boolean;
  readonly active?: boolean;              // for toggles
  readonly testID?: string;
}
```
Press scale animation via Reanimated (`withSpring`). `hitSlop` ensures a 44x44 target for `sm`. Every other button is a thin wrapper choosing icon and label from state; `SkipButton` takes `direction: "previous" | "next"`.

### 6.6 Progress bar (`ui/ProgressBar.tsx`)

Props: `positionMs`, `durationMs`, `bufferedMs`, `chapters`, `isLive`, `liveWindowMs`, `onSeekStart`, `onSeekPreview(ms)`, `onSeekCommit(ms)`, `disabled`. Layers: track, buffered fill, played fill, chapter tick marks, thumb (grows while scrubbing). Preview label above the thumb during drag. Accessibility: `accessibilityRole="adjustable"`, `accessibilityValue={{ min: 0, max: durationMs, now: positionMs, text: "1:12 of 4:20" }}`, `onAccessibilityAction` increment/decrement by `SKIP_MS`. Pure helpers: `msToFraction`, `fractionToMs`, `formatTime(ms, { showHours })`.

### 6.7 Tokens and constants

`components/VideoPlayer/tokens.ts` imports from `constants/tokens.ts` where a value exists (colours, spacing) and adds player-only tokens (overlay scrim `rgba(0,0,0,0.4)`, control sizes, z-indexes). `components/VideoPlayer/constants.ts` holds every timing and threshold named in this document, plus `ERROR_MESSAGES`, `PLAYBACK_RATES`, `ASPECT_16_9`, `INLINE_MAX_HEIGHT_RATIO` (0.304, the value the current player settled on after safe-area tuning), `MINI_PLAYER_WIDTH` (160). No numeric literal appears in a component or hook except 0, 1, and 2 in arithmetic.

---

## 7. Platform adapters (`components/VideoPlayer/platform/`)

Every adapter is a plain object exported from `<name>.native.ts` and `<name>.web.ts` implementing the interface in `platform/types.ts`. Every method returns `Promise<AdapterResult>` where `type AdapterResult = { ok: true } | { ok: false; reason: string }`. The composition root logs a failure once at `warn` and continues; a failed orientation lock never blocks fullscreen. Jest resolves `.native.ts` by default (jest-expo preset); web files are tested in a dedicated project config `jest.web.config.js` added in Increment 2 (`testEnvironment: jsdom`, `haste.defaultPlatform: "web"`).

| Adapter | Interface | Native | Web |
|---|---|---|---|
| `FullscreenAdapter` | `enter(): Promise<AdapterResult>; exit(); isActive(): boolean; subscribe(cb: (active: boolean) => void): () => void` | Sets an internal flag and emits; the composition root switches layout. Android hardware back is handled in the root via `BackHandler` to call `exit`. | `container.requestFullscreen()` / `document.exitFullscreen()`; subscribes to `fullscreenchange`; typed via `lib.dom`, no `as any` (vendor-prefixed variants are not supported; modern browsers only) |
| `OrientationAdapter` | `lock(mode: "landscape" \| "portrait"): Promise<AdapterResult>; unlock(); subscribe(cb: (isPortrait: boolean) => void)` | `expo-screen-orientation` `lockAsync(LANDSCAPE)` / `lockAsync(PORTRAIT_UP)` / `unlockAsync()`; `addOrientationChangeListener` | `screen.orientation.lock` when available else `{ ok: false }`; `matchMedia("(orientation: portrait)")` |
| `SystemChromeAdapter` | `hide(); show()` | `StatusBar.setHidden(hidden, "fade")`; Android navigation bar via `expo-navigation-bar` is **not** added (no new dependency); immersive nav is a later item | no-op |
| `KeyboardAdapter` | `subscribe(handler: (key: PlayerKey) => void): () => void` | returns no-op unsubscribe | `window.addEventListener("keydown")`, maps to `PlayerKey` union, ignores events when focus is in an input |
| `PictureInPictureAdapter` | `isSupported(): boolean; start(view: VideoViewRef): Promise<AdapterResult>; stop()` | `view.startPictureInPicture()` / `stopPictureInPicture()`; supported when `Platform.Version` meets expo-video's requirement (Android 8+, iOS 14+) | `HTMLVideoElement.requestPictureInPicture` when `document.pictureInPictureEnabled` and the `<video>` element rendered by expo-video's web `VideoView` can be located inside the surface container (`container.querySelector("video")`); otherwise `isSupported()` returns false and the button hides |
| `BrightnessAdapter` | `get(): Promise<number>; set(v: number): Promise<AdapterResult>; restore()` | `expo-brightness` `getBrightnessAsync` / `setBrightnessAsync`; `restore` resets to the value read on first `get` so leaving the player never leaves a dimmed device | CSS `filter: brightness()` on the surface container element |
| `HapticsAdapter` | `light(): void` | `expo-haptics` `impactAsync(Light)` fire-and-forget | no-op |

`PlayerKey = "togglePlay" | "fullscreen" | "mute" | "exit" | "seekBack5" | "seekForward5" | "seekBack10" | "seekForward10" | "seekPercent0" … "seekPercent9" | "rateDown" | "rateUp" | "captions"`.

---

## 8. Reliability and performance

### 8.1 Scenario matrix (each row is a test or a manual check id)

| Id | Scenario | Expected | Proof |
|---|---|---|---|
| S1 | Empty or malformed URL | container's resolver rejects before the player; if it reaches the player, `statusChange error` → `unsupported`, no retry | resolver test exists; engine test |
| S2 | 404 / 403 / expired URL | `error` with `expired`/`network`, retries 3x, manual Retry | fake player scripted |
| S3 | Unsupported codec | `error` `unsupported`, no retry button | fake player |
| S4 | MP4 → HLS source change while playing | one `replace`, status `loading` → `playing`, position 0, `onPositionChange` fired with final position of old source before change | hook test |
| S5 | VOD end | `playToEnd` → `ended`, end screen, countdown if autoplay-next and hasNext | reducer + EndScreen tests |
| S6 | Live stream end | `playToEnd` on live → `ended`, end screen without countdown (`hasNext` false for live) | reducer test |
| S7 | Replay | `commands.replay()` → `playing` from 0 | engine test |
| S8 | Slow network stall | no `timeUpdate` for 2 s → `buffering`, spinner; resume → `playing` | fake timers |
| S9 | Offline mid-play | native error → `network` → retries; the app may show its offline banner via `onStateChange` | engine test; container test |
| S10 | Timeout on load | `loading` for `LOAD_TIMEOUT_MS` (15,000) → synthetic `network` error with retry | engine test |
| S11 | Unmount during `loading` | dispose cancels timers, no state update after unmount (no React warning) | hook test |
| S12 | Navigate away mid-play | screen unmount → dispose → `player.pause()` before release | hook test |
| S13 | Background / foreground | pause on background; on foreground stays paused with controls visible | engine test with mocked `AppState` |
| S14 | Rotate during scrub | scrub cancelled, no seek committed, layout updates | gesture test |
| S15 | Rapid seeks (10 in 1 s) | last seek wins, no error, no stuck buffering | engine test |
| S16 | Play/pause spam (20 toggles) | final state matches parity of toggles | engine test |
| S17 | Fullscreen toggled while buffering | layout switches, status unchanged, spinner persists | root test |
| S18 | Stale callback: `onFinished` changes between renders | latest callback is called | root test with ref pattern |
| S19 | Two players mounted (Shorts feed and a Video screen in the stack) | not addressed by the player; the app is responsible for pausing the hidden one; recorded as a container-level later item | documented |
| S20 | Resource audit after unmount | engine `disposables` empty; no `setTimeout` pending; `AppState` listener removed; brightness restored | hook test with fake timers and spies |

### 8.2 Performance targets (proposed, pending human confirmation — ADR 0012)

Reference devices: low-end Android (2 GB RAM, Android 10 class, for example Redmi 9A or Galaxy A03), iPhone SE 2nd generation, Chrome and Safari current stable.

| Id | Metric | Target | Method |
|---|---|---|---|
| P1 | Time to first frame, MP4, 4G | ≤ 2,000 ms | `onStateChange` timestamps `loading` → `ready`, averaged over 5 runs, recorded in the increment report |
| P2 | Time to first frame, HLS, 4G | ≤ 3,000 ms | same |
| P3 | Control tap to command dispatch | ≤ 100 ms | `performance.now()` around the handler in dev build |
| P4 | Composition-root renders per second while playing, controls hidden | ≤ 4 | render counter test with fake `timeUpdate` at 250 ms; React Profiler on device |
| P5 | Memory growth after 10 source changes | ≤ 30 MB | Android Studio Memory Profiler; Xcode Instruments Allocations |
| P6 | Timers and listeners alive after unmount | 0 | S20 |
| P7 | Controls fade | no JS-thread frame drops | Reanimated shared value; Perf Monitor JS FPS stays ≥ 55 during fade |
| P8 | Player bundle contribution | ≥ 40 percent smaller than the current player's contribution | `npx expo export --platform android --dump-sourcemap` before and after, `source-map-explorer` on `components/VideoPlayer` |
| P9 | Battery: 30 min playback, screen on | no worse than current player | Android Battery Historian, informational |

Baselines for P4, P5, P8 on the current player are captured in Increment 0 before any new code.

---

## 9. Testing strategy

| Layer | Tool | Location | What |
|---|---|---|---|
| Pure units | Jest, no RN | `__tests__/player/engine/*.test.ts`, `__tests__/player/pure/*.test.ts` | reducer full table, retry policy, classifyError, seek clamping, `selectCue`, `currentChapter`, `formatTime`, keyboard mapping, download registry reducer |
| Engine | Jest + `fakeVideoPlayer` (an `EventEmitter`-based object implementing the subset of `VideoPlayer` the engine uses: `play`, `pause`, `replace`, `seekBy`, `replay`, `addListener`, properties) | `__tests__/player/engine/PlaybackEngine.test.ts` | E1–E10, S2–S16 |
| Hook | RNTL `renderHook`, fake timers, mocked `AppState` | `__tests__/player/engine/usePlaybackEngine.test.tsx` | S4, S11, S12, S13, S20, position cadence |
| Components | RNTL | `__tests__/player/ui/*.test.tsx` | every control in every state; labels; hit slop; progress bar accessibility actions; visibility timing |
| Gestures | RNTL + `react-native-gesture-handler/jest-utils` `fireGestureHandler` | `__tests__/player/gestures/*.test.tsx` | zones, double-tap, long-press, swipe deltas |
| Platform adapters | Jest native config + `jest.web.config.js` (jsdom) | `__tests__/player/platform/*.test.ts` | each method's ok and failure result; web listeners removed on unsubscribe |
| Composition root | RNTL with mocked engine hook | `__tests__/player/VideoPlayer.root.test.tsx` | layout modes, prop forwarding, parity suite (the existing `VideoPlayer.render.test.tsx` cases re-expressed for the new props) |
| Container and actions | RNTL, repository mocked | `__tests__/components/VideoPlaybackContainer.test.tsx` (updated at swap), `__tests__/components/actions/*.test.tsx` | mapping, `file://` preference, optimistic rollback, in-flight guard, stale response by sequence number |
| Services | Jest | `__tests__/services/videoActions/*.test.ts` | local repository round-trip and corrupt payload reset; download registry; `unavailablePaymentProvider` |
| Invariants | Jest | `__tests__/player/invariants.test.ts` | R1–R7 as greps over the source tree |
| Manual device matrix | human | `docs/player/09-test-plan.md` section 6 | rotation, PiP, brightness, background, cellular handoff, on Android, iOS, Chrome, Safari; recorded as run or not run |

Scripts: `npm test`, `npm run lint`, `npx tsc --noEmit`. No other scripts. Increment 0 adds `"test:web": "jest -c jest.web.config.js"` to `package.json` because web adapters cannot be tested under the native preset; this is the only script change and it is recorded in the plan.

---

## 10. Migration and swap

| Step | Increment | Content | Exit criteria |
|---|---|---|---|
| S0 | 0 — Baseline | `npm install` in main checkout; run `npm test` and record; capture P4, P5, P8 baselines on the current player; extend characterization tests to every visible behaviour listed in the parity checklist (`docs/player/10-migration-and-swap.md`); add `__tests__/player/invariants.test.ts` with R1, R2, R7 (R3–R6 are activated when the new folders exist); install `expo-brightness` via `npx expo install` | tests green; baseline table filled |
| S1 | 1 — Engine | `engine/` complete with tests; `constants.ts`, `tokens.ts` | 100 percent of reducer table tested; E1–E10 green; R3 active |
| S2 | 2 — Platform | `platform/` native and web with tests; `jest.web.config.js`; per-platform verification note for quality selection and PiP support | adapter tests green on both configs |
| S3 | 3 — UI and gestures | `ui/`, `gestures/` with tests; Storybook is **not** added (no new dependency); a dev-only route is **not** added (rule N8: no demo screens) | component tests green; R4–R6 active |
| S4 | 4 — Composition root | new `components/VideoPlayer/Player.tsx` (temporary name, becomes the default export at S6), `types.ts`; root tests | parity suite green against `Player.tsx` |
| S5 | 5 — Actions and services | `components/Video/actions/*`, `services/videoActions/*`; move and rewire sheets; tests | action tests green; old `hooks/useVideoActions.ts` and `services/videoActionsService.ts` still present |
| S6 | 6 — Swap | `index.tsx` becomes `export { Player as default } from "./Player"; export * from "./types";`; container moves to `VideoPlayerProps` and renders `VideoActionBar`; `__tests__/components/VideoPlaybackContainer.test.tsx` updated; manual device matrix run on one Android and one iOS device and recorded | `npm test`, `npm run lint`, `npx tsc --noEmit` green; matrix recorded |
| S7 | 7 — Cleanup | move old flat player files, `hooks/useVideoProgress.ts`, `hooks/useVideoActions.ts`, `services/videoActionsService.ts` to `docs/history/videoplayer/2026-09-16-pre-redesign/`; update `CLAUDE.md` section 1, `docs/engineering/video-player.md`, `docs/reference/Project-structure-of-expo-live-player.md`; flip `PLAYER_FEATURE_FLAGS` for features whose acceptance tests pass | R1–R7 green; docs updated; report of what is flagged on and off |

Rollback at any step before S7: revert the S6 commit; the old files are untouched and live. After S7: revert S7 and S6 together.

Each increment is one implementation plan file and one branch (`feature/player-<n>-<name>`), merged to `main` only when its exit criteria are met and recorded.

---

## 11. Documentation set produced from this spec

| Document | Path | Contents |
|---|---|---|
| Issue register | `docs/player/01-current-player-issue-register.md` | D1–D20 and any found during Increment 0, each with file, lines, evidence, severity, the section of this spec that resolves it, and the increment that removes it |
| Feature catalog | `docs/player/02-feature-catalog.md` | F1–F38 with user goal, preconditions, flow, every state (loading, success, empty, invalid, failure, offline, retry, cancel), owner, constants used, tests |
| Architecture | `docs/player/03-architecture.md` | sections 3 and 4.6 expanded; module cards (responsibility, interface, depends on, proof); dependency diagram; Shorts migration path |
| Engine spec | `docs/player/04-playback-engine-spec.md` | section 4 expanded; sequence diagrams for load, retry, background, source change, dispose; fake player contract |
| Platform adapters spec | `docs/player/05-platform-adapters-spec.md` | section 7 expanded; per-method behaviour, failure reasons, web browser support notes |
| UI and gestures spec | `docs/player/06-ui-and-gestures-spec.md` | section 6 expanded; every control's states, icons, labels; token table; gesture thresholds; accessibility checklist |
| App actions and repositories | `docs/player/07-app-actions-and-repositories.md` | section 5.3 expanded; interfaces with full signatures; local implementation storage schema; download state machine; payment provider contract; backend swap guide |
| Reliability and performance | `docs/player/08-reliability-and-performance.md` | section 8 expanded; measurement procedures step by step; baseline table template |
| Test plan | `docs/player/09-test-plan.md` | section 9 expanded; test inventory per file; fixtures; manual device matrix with pass criteria |
| Migration and swap runbook | `docs/player/10-migration-and-swap.md` | section 10 expanded; parity checklist; rollback procedure; docs-to-update list |
| ADRs | `docs/player/adr/0001-parallel-rebuild.md` … `0012-performance-targets-pending.md` | context, decision, alternatives, consequences |
| Implementation plans | `docs/superpowers/plans/2026-09-16-video-player-0<n>-<name>.md` | produced by the writing-plans skill after this spec is approved; one per increment, plus an index |

---

## 12. Open items requiring the human

| Id | Item | Default until answered |
|---|---|---|
| O1 | Confirm or change device baseline and targets (section 8.2) | Implement and measure against the proposed table |
| O2 | Should the engine auto-resume on foreground (rule L4)? | No auto-resume |
| O3 | Remove `react-native-paper` from `package.json` after S7 (it will have no importers)? | Keep; separate dependency ADR later |
| O4 | Android immersive navigation bar in fullscreen needs `expo-navigation-bar` | Not added; status bar only |
| O5 | Now-playing notification and background audio (`showNowPlayingNotification`, `staysActiveInBackground`) | Both off |
| O6 | Web: which browsers are in the manual matrix | Chrome and Safari current stable, desktop and mobile |

---

## 13. Glossary

- **Snapshot**: the immutable `PlaybackSnapshot` object the engine publishes; the only playback state the UI reads.
- **Engine**: `PlaybackEngine`, the headless wrapper around one expo-video player.
- **Composition root**: `components/VideoPlayer/index.tsx` (during the build, `Player.tsx`), which wires engine, adapters, gestures and UI.
- **Container**: `components/Video/VideoPlaybackContainer.tsx`, the only app module allowed to import the player.
- **Adapter**: a platform capability behind an interface with `.native.ts` and `.web.ts` implementations.
- **Repository**: an interface for app-action persistence with swappable implementations.
- **Parity checklist**: the list of current visible behaviours the new player must reproduce before the swap.
- **Increment**: one plan file, one branch, one merge, with recorded exit criteria.
- **Invariant test**: a Jest test that greps the source tree to enforce a dependency rule.
