# 09 — Test Plan

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 9 |
| Rules | `docs/engineering/testing.md`; CLAUDE.md section 12 |
| Scripts | `npm test` (Jest, jest-expo preset), `npm run test:web` (added in Increment 0: `jest -c jest.web.config.js`), `npm run lint`, `npx tsc --noEmit`. No other scripts. |
| Harness | Existing `__tests__/harness/` (setup, mocks) is extended, never duplicated. |

## 1. Principles

1. Test-first for every unit: write the failing test named in this plan, then the code.
2. Tests assert behaviour visible through the unit's interface, never internal variables.
3. Every timer-based behaviour uses `jest.useFakeTimers()` and asserts `jest.getTimerCount() === 0` after unmount.
4. Native modules are mocked once in the harness; individual tests do not re-mock unless they need a scripted behaviour.
5. No test is skipped, weakened, or deleted to make a suite pass. A failing test that reveals a spec gap is reported, not removed.

## 2. Jest configuration

### 2.1 Default project (`package.json` → `jest`)

Already present: `preset: "jest-expo"`, `testMatch`, `setupFilesAfterEnv` with RNTL matchers. Increment 0 adds to `__tests__/harness/setup.ts` (or the existing setup file — check `package.json` `setupFilesAfterEnv` and extend that file):

```ts
jest.mock("expo-screen-orientation", () => ({ lockAsync: jest.fn().mockResolvedValue(undefined), unlockAsync: jest.fn().mockResolvedValue(undefined), addOrientationChangeListener: jest.fn(() => ({ remove: jest.fn() })), removeOrientationChangeListener: jest.fn(), OrientationLock: { LANDSCAPE: "LANDSCAPE", PORTRAIT_UP: "PORTRAIT_UP" }, Orientation: { PORTRAIT_UP: 1, PORTRAIT_DOWN: 2, LANDSCAPE_LEFT: 3, LANDSCAPE_RIGHT: 4 } }));
jest.mock("expo-brightness", () => ({ getBrightnessAsync: jest.fn().mockResolvedValue(0.5), setBrightnessAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn().mockResolvedValue(undefined), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
```

`react-native-gesture-handler` tests import `fireGestureHandler` and `getByGestureTestId` from `react-native-gesture-handler/jest-utils`; components set `.withTestId("player-tap")` etc. on gestures.

### 2.2 Web project (`jest.web.config.js`, Increment 0)

```js
module.exports = {
  preset: "jest-expo/web",
  testEnvironment: "jsdom",
  testMatch: ["**/__tests__/player/platform/*.web.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/harness/setup.web.ts"],
};
```

`jest-expo/web` sets `haste.defaultPlatform` to `web` so `.web.ts` files resolve. If `jest-expo/web` is not available in the installed version, use `preset: "jest-expo"` with `haste: { defaultPlatform: "web", platforms: ["web"] }` and record which was used.

## 3. Test inventory

Column "Increment" is where the test is written. Every file below must exist by the end of its increment.

### 3.1 Engine (Increment 1)

| File | Cases |
|---|---|
| `__tests__/player/engine/initialSnapshot.test.ts` | default values; overrides |
| `__tests__/player/engine/playbackReducer.test.ts` | `TRANSITIONS` table (every non-ignored cell of 04 §3); ignored pairs return `prev` by reference; field updates for `timeUpdate`, `rateChange`, `mutedChange`, `volumeChange`, `qualitiesChange`, `subtitlesChange`, `pipChange`, `retryScheduled`; buffering exit rule; invariant loop over statuses × events |
| `__tests__/player/engine/retryPolicy.test.ts` | attempts 0/1/2/3; non-retryable |
| `__tests__/player/engine/classifyError.test.ts` | each substring → code; fallback; `stripQuery` |
| `__tests__/player/engine/PlaybackEngine.test.ts` | E1 subscription count and dispose; E2 setup properties; E3 setSource sequence incl. resume position and autoplay; E4 stall; E6 retry schedule, manual retry, cancel on setSource; E7 each command's validation and no-op states; E8 background/foreground; E10 reference equality; E11 load timeout; E12 lastKnownPosition; S2, S3, S7, S8, S10, S15, S16, S21 |
| `__tests__/player/engine/usePlaybackEngine.test.tsx` | F10.1–F10.6; F15.1–F15.4; S4, S11, S12, S13, S20; same-URL re-render → no `replace` |
| `__tests__/player/pure/selectCue.test.ts` | boundaries; empty; unsorted input rejected in dev |
| `__tests__/player/pure/currentChapter.test.ts` | before first; exact start; between; after last |
| `__tests__/player/pure/formatTime.test.ts` | 0, 59 s, 1 h, negative, NaN |
| `__tests__/player/pure/clamp.test.ts` | bounds |

### 3.2 Platform (Increment 2)

See `05-platform-adapters-spec.md` §6 for the twelve files and cases.

### 3.3 UI and gestures (Increment 3)

| File | Cases |
|---|---|
| `__tests__/player/ui/ControlButton.test.tsx` | label, role, disabled, selected, hitSlop for sm, onPress once |
| `__tests__/player/ui/PlayPauseButton.test.tsx` | icon/label per status; commands per status; hidden statuses |
| `__tests__/player/ui/SkipButton.test.tsx` | both directions; disabled |
| `__tests__/player/ui/FullscreenButton.test.tsx`, `MuteButton`, `AutoplayToggle`, `PipButton`, `SettingsButton`, `MinimizeButton`, `GoLiveButton`, `LiveBadge` | state → icon/label; press → callback; visibility rules |
| `__tests__/player/ui/ProgressBar.test.tsx` | fractions; buffered width; chapter ticks and tap seek; scrub preview/commit/cancel; hidden for live without window; accessibility value and actions; haptic on commit |
| `__tests__/player/ui/TimeLabel.test.tsx` | VOD; live at edge; live behind; chapter title |
| `__tests__/player/ui/CaptionsView.test.tsx` | cue shown; none; font scale |
| `__tests__/player/ui/BufferingIndicator.test.tsx` | delay; statuses; unmount clears timer |
| `__tests__/player/ui/ErrorCard.test.tsx` | hidden; retrying; retry button; non-retryable |
| `__tests__/player/ui/EndScreen.test.tsx` | replay only; countdown text; cancel |
| `__tests__/player/ui/Toast.test.tsx` | show; replace; auto-dismiss |
| `__tests__/player/ui/SwipeIndicator.test.tsx` | kinds; hidden |
| `__tests__/player/ui/SettingsSheet.test.tsx` | rates; captions switch hidden/shown; subtitle tracks; quality label; close |
| `__tests__/player/ui/MiniPlayer.test.tsx` | restore on video press; close; play/pause |
| `__tests__/player/ui/PlayerSurface.test.tsx` | VideoView props; poster toggle; ref forwarded |
| `__tests__/player/ui/ControlsOverlay.test.tsx` | rows per status/isLive/pipSupported; pointerEvents when hidden |
| `__tests__/player/gestures/useControlsVisibility.test.tsx` | V1–V9 with fake timers |
| `__tests__/player/gestures/useTapGestures.test.tsx` | single tap; double tap zones; long press start/end; disabled |
| `__tests__/player/gestures/useSwipeGestures.test.tsx` | side selection; delta; clamp; activation; disabled |

### 3.4 Composition root (Increment 4)

| File | Cases |
|---|---|
| `__tests__/player/VideoPlayer.root.test.tsx` | renders with no providers; layout modes; fullscreen enter/exit keeps `VideoView` node identity (`getByTestId("player-video-view")` same instance via `toBe`); `BackHandler` in fullscreen; `onStateChange` forwarded (S18 latest ref); `onFinished` after countdown; keyboard adapter mapping to commands (with fake adapter); PiP toggle; gestures disabled when minimized/sheet/error; unmount restores orientation/chrome/brightness (S17, S25, S26) |
| `__tests__/player/VideoPlayer.root.perf.test.tsx` | P4 render count ≤ 20 in 5 s of fake `timeUpdate` |
| `__tests__/player/VideoPlayer.parity.test.tsx` | the parity checklist from `10-migration-and-swap.md` §3 expressed as tests against `Player.tsx` |

### 3.5 Actions and services (Increment 5)

| File | Cases |
|---|---|
| `__tests__/services/videoActions/localVideoActionsRepository.test.ts` | each method round-trip; idempotency; mutual exclusion; corrupt payload reset; debounce; clip validation |
| `__tests__/services/videoActions/downloadService.test.ts` | state machine table (07 §5.3); throttle; cancel deletes; restart → paused; `resolveLocalUri`; HLS rejected; storage-full |
| `__tests__/services/videoActions/unavailablePaymentProvider.test.ts` | presets; rejects |
| `__tests__/components/actions/useVideoActions.test.tsx` | load; optimistic like/dislike; rollback; in-flight guard; stale seq; analytics; unmount |
| `__tests__/components/actions/VideoActionBar.test.tsx` | moved from `__tests__/player/`; flags; HLS hides Download; Thanks flag |
| `__tests__/components/actions/SaveSheet.test.tsx`, `ShareSheet.test.tsx` | moved; unchanged |
| `__tests__/components/actions/DownloadSheet.test.tsx` | every state from F33 |
| `__tests__/components/actions/ClipEditor.test.tsx` | validation; save; copy |
| `__tests__/components/actions/ReportSheet.test.tsx`, `OverflowMenu.test.tsx` | reasons; idempotent toast; removed rows absent |
| `__tests__/components/actions/ThanksSheet.test.tsx` | unavailable state; fake available provider success/failure |

### 3.6 Container and swap (Increment 6)

| File | Cases |
|---|---|
| `__tests__/components/VideoPlaybackContainer.test.tsx` | prop mapping table (each `VideoPlayerProps` key); `file://` preference and fallback; action bar hidden in fullscreen/minimized; analytics `video_start`/`video_finish`/`video_progress` |
| `__tests__/screens/VideoScreen.test.tsx` | updated for the new container props |

### 3.7 Invariants (Increment 0 onward)

`__tests__/player/invariants.test.ts` reads the source tree with `fs` and asserts R1–R7 from `03-architecture.md` §2, plus:
- no `setInterval` under `components/VideoPlayer/` (after Increment 1 the old files still contain some — the test scopes to the new folders until Increment 7, then to the whole folder);
- no file under the new folders exceeds its line budget (R9);
- `components/VideoPlayer/index.tsx` is byte-identical to `main` until Increment 6 (`git show main:components/VideoPlayer/index.tsx` compared with the file; skipped when `git` is unavailable in CI with a logged note).

## 4. Fixtures and fakes

### 4.1 `__tests__/player/fakes/fakeVideoPlayer.ts`
Contract in `04-playback-engine-spec.md` §6.

### 4.2 `__tests__/player/fakes/fakeAdapters.ts`
`createFakeFullscreenAdapter()`, `createFakeOrientationAdapter()`, … each recording calls and allowing `nextResult = fail("x")`.

### 4.3 `__tests__/player/fakes/snapshots.ts`
`playingSnapshot(overrides)`, `pausedSnapshot`, `bufferingSnapshot`, `endedSnapshot`, `errorSnapshot(code)`, `liveSnapshot(offsetMs)` built from `createInitialSnapshot`.

### 4.4 `__tests__/player/fakes/fakeEngineHook.ts`
`mockUsePlaybackEngine(snapshot)` for root tests: `jest.mock("../../components/VideoPlayer/engine/usePlaybackEngine")` returning `{ snapshot, commands: fakeCommands(), player: {}, notifyPictureInPicture }` with a `setSnapshot` helper to drive re-renders.

### 4.5 Sources
`MP4 = "https://example.test/video.mp4"`, `HLS = "https://example.test/stream.m3u8"`, `LIVE = { url: HLS, kind: "hls", isLive: true }`, `LOCAL = "file:///data/videos/v1.mp4"`.

## 5. Quality gate per increment

```
npm test                       all suites pass, no skipped tests
npm run test:web               (from Increment 2) passes
npm run lint                   0 errors; warnings not increased vs. the recorded baseline
npx tsc --noEmit               0 errors in new/touched files; total not above baseline (18 pre-existing outside scope)
invariants.test.ts             passes
```

Record the exact output counts in the increment report (`docs/superpowers/plans/…-report.md`).

## 6. Manual device matrix (human-run; record "run" or "not run" per cell)

| # | Check | Pass criterion | Android low-end | iOS | Chrome | Safari |
|---|---|---|---|---|---|---|
| M1 | Play MP4 from Home | first frame ≤ P1; controls respond | | | | |
| M2 | Play HLS VOD | first frame ≤ P2 | | | | |
| M3 | Play HLS live | LIVE badge; Go live after seeking back | | | | |
| M4 | Rotate to landscape mid-play | fullscreen; position continuous; no black flash | | | | n/a |
| M5 | Exit fullscreen (button, back, Escape) | chrome restored; position continuous | | | | |
| M6 | Background during play, return | paused; play button visible; no audio while backgrounded | | | n/a | n/a |
| M7 | Lock screen, unlock | as M6 | | | n/a | n/a |
| M8 | Incoming call | pauses; resumes cleanly by user | | | n/a | n/a |
| M9 | Navigate away mid-play | audio stops immediately | | | | |
| M10 | Autoplay-next countdown | next video loads at 0 | | | | |
| M11 | Airplane mode mid-play | error card; retries; retry succeeds after reconnect | | | | |
| M12 | Throttled network | buffering spinner; recovers | | | | |
| M13 | Double-tap left/right/centre | ±10 s / toggle; ripple label | | | n/a | n/a |
| M14 | Brightness and volume swipes | levels change; indicator; brightness restored on leave | | | web CSS only | web CSS only |
| M15 | Long press | 2× while held | | | | |
| M16 | Scrub and chapter tap | preview label; seek lands | | | | |
| M17 | Captions from prop and embedded track | cue shown; track selectable | | | | |
| M18 | Speed change | audible; toast | | | | |
| M19 | PiP | enters; controls hidden; exits | 8+ | 14+ | | n/a |
| M20 | Mini-player | layout; restore | | | | |
| M21 | Keyboard shortcuts | each key | n/a | n/a | | |
| M22 | Like/Dislike/Save/Share | persist across restart (like), share sheet opens | | | | |
| M23 | Download MP4, airplane mode, play | plays from file | | | n/a | n/a |
| M24 | Report, Not interested | toast; idempotent | | | | |
| M25 | Thanks | coming-soon state | | | | |
| M26 | Shorts tab | unchanged behaviour | | | | |
| M27 | Screen reader pass (TalkBack / VoiceOver) | every control announced with state | | | | |

## 7. Regression policy

Every defect found after Increment 4 gets a test in the relevant file before the fix, named `regression: <short description>`. The issue register (`01-…`) gains a row with the test name.
