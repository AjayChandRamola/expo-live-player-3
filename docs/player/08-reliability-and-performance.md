# 08 — Reliability and Performance

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 8 |
| ADR | 0012 (targets pending human confirmation) |
| Rules | `docs/engineering/performance.md`, CLAUDE.md sections 7 and 11 |

## 1. Reliability scenario matrix (normative)

Each row names the scenario, the expected observable behaviour, the automated test that proves it, and whether a manual check is also required. "Manual" rows are copied into `09-test-plan.md` section 6.

| Id | Scenario | Expected | Automated proof | Manual |
|---|---|---|---|---|
| S1 | Empty or malformed URL | Never reaches the player (`mediaSourceResolver` rejects). If it does: `error` with code `unsupported`, no retry button. | `__tests__/services/mediaSourceResolver.test.ts` (exists); `PlaybackEngine.test.ts` "unsupported error has no retry" | no |
| S2 | 403 / expired URL | `error` `expired`, 3 automatic retries at 1/2/4 s, then manual Retry | `PlaybackEngine.test.ts` "retry schedule" | Android, iOS: expire a signed URL and observe |
| S3 | Unsupported codec | `error` `unsupported`, no retries | engine test | no |
| S4 | MP4 → HLS source change while playing | one `replace`; `loading` → `playing`; position 0; `onPositionChange` fired with the old position before the change | `usePlaybackEngine.test.tsx` "source change" | no |
| S5 | VOD end | `playToEnd` → `ended`; end screen; countdown when autoplay-next and hasNext | reducer test; `EndScreen.test.tsx`; root test | Android, iOS |
| S6 | Live stream ends | `ended` without countdown | reducer test with `isLive` | Android, iOS on a real ending stream |
| S7 | Replay | `replay()` → `playing` from 0 | engine test | no |
| S8 | Slow network stall | no `timeUpdate` for 2 s → `buffering` + spinner; recovery → `playing` | engine test with fake timers | Android low-end, throttled to 3G |
| S9 | Offline mid-play | native error → `network` → retries; app banner via `onStateChange` | engine test; container test asserts `onStateChange` receives `error` | Android, iOS airplane mode |
| S10 | Load timeout | `loading` 15 s → synthetic `network` error | engine test | no |
| S11 | Unmount during `loading` | no state update after unmount; timers cleared | hook test | no |
| S12 | Navigate away mid-play | `pause()` then dispose; no orphan audio | hook test asserts `pause` before `disposed` | Android, iOS |
| S13 | Background / foreground | pause on background; stays paused on foreground | engine test with mocked `AppState` | Android, iOS (home button, lock screen, incoming call) |
| S14 | Rotate during scrub | drag cancelled, no seek committed | `ProgressBar.test.tsx` "cancel" | Android, iOS |
| S15 | Rapid seeks (10 in 1 s) | last wins; no error; no stuck `buffering` | engine test | no |
| S16 | Play/pause spam (20 toggles) | final state = parity | engine test | no |
| S17 | Fullscreen toggled while buffering | layout switches; status unchanged | root test | Android, iOS |
| S18 | Stale callback (`onFinished` changes between renders) | latest callback called | root test | no |
| S19 | Two players mounted | out of player scope; app must pause the hidden one | documented only | Shorts tab then Video screen: note behaviour |
| S20 | Resource audit after unmount | `disposables` empty; `jest.getTimerCount() === 0`; `AppState` listener removed; brightness restored | hook test | no |
| S21 | Headers never logged | `Logger` spy receives no string containing a header value or a `?` query string | engine test | no |
| S22 | Low memory (Android kills the activity in background) | on relaunch the screen restores from route params; the player starts from `initialPositionMs` supplied by the app if it persisted one | not automatable here | Android: developer option "Don't keep activities" |
| S23 | Cellular hand-off (Wi-Fi → mobile data) | either continues or `network` error with retry succeeding | not automatable | Android, iOS |
| S24 | Incoming call | pauses (system interrupts audio); user resumes | not automatable | Android, iOS |
| S25 | PiP enter/exit | `isPictureInPicture` toggles; controls hidden in PiP; playback continuous | root test with adapter fake | Android 8+, iOS 14+, Chrome |
| S26 | Brightness restored | leaving the player restores the initial level | adapter test | Android, iOS |

## 2. Performance targets (proposed; see ADR 0012)

Reference devices: low-end Android (2 GB RAM, Android 10 class), iPhone SE 2nd generation, Chrome and Safari current stable. Network for P1/P2: 4G or a throttled profile "Fast 3G" in the browser and Network Link Conditioner "LTE" on iOS; on Android use Android Studio's network profiler or a router-level throttle. Record the actual condition used.

| Id | Metric | Target | Where measured | How |
|---|---|---|---|---|
| P1 | Time to first frame, MP4 | ≤ 2,000 ms | device, dev build | Add a temporary `onStateChange` listener in the container (dev only, removed after measurement) logging `Date.now()` at `loading` and at the first `playing`. Average of 5 cold starts of the same video. |
| P2 | Time to first frame, HLS | ≤ 3,000 ms | device | same |
| P3 | Tap to command dispatch | ≤ 100 ms | dev build | `performance.now()` at `Pressable` `onPress` entry and at the engine command entry (dev-only instrumentation behind `__DEV__`, removed after) |
| P4 | Composition-root renders per second while playing, controls hidden | ≤ 4 | Jest and device | Jest: `__tests__/player/VideoPlayer.root.perf.test.tsx` wraps `Player` in a render counter, emits `timeUpdate` every 250 ms for 5 s of fake time, asserts ≤ 20 renders. Device: React DevTools Profiler, 10 s window. |
| P5 | Memory growth after 10 source changes | ≤ 30 MB | device | Android Studio Memory Profiler (Java + native heap) or Xcode Instruments Allocations: baseline after first play, then 10 `Next` presses, force GC, read delta. |
| P6 | Timers and listeners after unmount | 0 | Jest | S20 |
| P7 | Controls fade | JS FPS ≥ 55 during fade | device | Expo dev menu Perf Monitor while tapping to show/hide 10 times |
| P8 | Player bundle contribution | ≥ 40 percent smaller than baseline | CI or local | `npx expo export --platform android --source-maps` then `npx source-map-explorer dist/_expo/static/js/android/*.js --json` and sum sizes of modules under `components/VideoPlayer` (and, for the baseline, `hooks/useVideoProgress`, `hooks/useVideoActions`). Record both numbers. |
| P9 | Battery, 30 min playback | no worse than baseline | device | Android Battery Historian or Settings → Battery usage per app; informational |

## 3. Baseline procedure (Increment 0)

1. `npm install` in the main checkout; confirm `npm test` passes and record counts.
2. Build a dev client or use Expo Go on the reference Android device; open a known MP4 from Home.
3. Record P4 (Profiler), P5 (Memory Profiler), P8 (bundle), P1/P2 (with the temporary listener) for the **current** player. Store the table in `docs/player/baselines/2026-09-XX-current-player.md` with device model, OS version, network condition, and app build id.
4. If a device is not available, record "not measured — no device" in the same table. Do not estimate.

## 4. Resource ownership table (what must be cleaned up, by whom)

| Resource | Owner | Cleanup point | Test |
|---|---|---|---|
| expo-video player instance | `useVideoPlayer` in `usePlaybackEngine` | hook unmount (library cleanup) | S20 (mock `release` not asserted; library-owned) |
| 12 event subscriptions | `PlaybackEngine.disposables` | `dispose()` | S20 |
| stall / retry / load timers | `PlaybackEngine` | `dispose()`, `setSource()` | S20, F8.4 |
| `AppState` listener | `usePlaybackEngine` | hook unmount | S20 |
| controls visibility timers | `useControlsVisibility` | hook unmount | V8 test |
| end-screen interval | `useEndScreenCountdown` | leaving `ended`, unmount | EndScreen test |
| toast timer | `useToast` | unmount | Toast test |
| buffering delay timer | `BufferingIndicator` | unmount / status change | test |
| swipe indicator timer | `useSwipeGestures` | unmount | test |
| orientation subscription | `useFullscreen` (root hook) | unmount; also unlocks orientation and shows chrome if fullscreen | root test |
| `BackHandler` subscription | `useFullscreen` | unmount | root test |
| keyboard / hover listeners (web) | `useKeyboardShortcuts` | unmount | web adapter test |
| fullscreenchange listener (web) | `fullscreen.web` | unsubscribe | web adapter test |
| brightness level | `brightnessAdapter` | `restore()` on unmount and on leaving fullscreen | S26 |
| Reanimated shared values | components | automatic | — |
| download resumables | `downloadService` | app lifetime; paused on restart | download tests |

## 5. Render budget rules (how P4 is achieved)

- `useSyncExternalStore` returns the same snapshot reference when nothing changed, so React skips the render.
- `timeUpdate` at 250 ms produces at most 4 snapshots per second; the root renders at most 4 times per second. Controls that do not depend on position (`PlayPauseButton`, `SkipButton`, top row) are `memo`-wrapped with stable callback props (`useCallback` in the root, or commands from the engine which are stable by construction).
- `ProgressBar` and `TimeLabel` receive position and are expected to render 4 times per second; they must do no allocation-heavy work (precompute fractions with simple arithmetic; no array mapping of chapters per render — `useMemo` on `chapters`).
- The controls fade is a shared value; no React render happens during the fade.
- Position reporting to the app (`onPositionChange`) fires at most every 5 s, so the app's own state does not re-render the screen with playback.

## 6. Reporting template (copy into each increment's report)

```
## Performance (ADR 0012 targets)
| Id | Target | Measured | Device / condition | Pass |
|----|--------|----------|--------------------|------|
| P1 | ≤ 2000 ms | … | … | yes/no/not measured |
…
## Reliability manual rows run
| Id | Android | iOS | Web | Notes |
…
```
