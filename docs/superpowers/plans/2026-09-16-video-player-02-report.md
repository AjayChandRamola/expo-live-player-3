# Increment 1 — Engine Report

Date: 2026-09-16  Branch: `feature/player-1-engine` (from `main` @ `1957641`, the Increment 0 merge)

## Gate

- `npm test`: **57 suites passed, 615 passed, 3 skipped, 618 total** (Increment 0: 44 suites, 391 passed, 5 skipped)
- `npm run test:web`: 1 suite, 2 passed (unchanged — this increment added no web-platform code)
- `npm run lint`: **1 error, 396 warnings** — identical to the Increment 0 baseline. `npx eslint components/VideoPlayer/engine __tests__/player/engine __tests__/player/fakes __tests__/player/pure` on just the new files produces **zero output**; every warning and the one error are pre-existing and outside the player.
- `npx tsc --noEmit`: **21 errors**, same count and same files as Increment 0 (`Comments/*`, `GlobalErrorLogger.ts`, `ShortsSearchBar.tsx`, `useVoiceSearch.ts`, `app/_layout.tsx`, `app/`). None under `components/VideoPlayer/engine`, `components/VideoPlayer/*.ts`, or `__tests__/player`.
- Invariants: **R1, R2, R3, R6, R7, OLD_ROOT_FROZEN passing** (6 passed, 3 skipped — R4, R5, R9 stay inactive; see "File budget" below).

## Coverage of the transition table

- `playbackReducer.test.ts`: Part A (source/status/playing/disposed) 61 rows/tests; Part B (time/end/stall/app-state) plus targeted unit tests plus field events plus the invariants sweep (8 statuses × 17 events) brings the file to **118 passing tests total**.
- `PlaybackEngine.test.ts`: **40 passing tests** across construction/dispose (E1/E2), setSource/first-ready (E3, E10, E12), stall (E4), errors/retry/load-timeout (E6, E11), commands (E7), app-state/PiP/tracks (E8).
- `usePlaybackEngine.test.tsx`: **9 passing tests** covering F10 lifecycle, F15 position reporting, S4, S11–S13, S20.
- Pure helpers: `clamp` (5), `formatTime` (6), `selectCue` (9), `currentChapter` (4), `classifyError`/`stripQuery` (13), `retryPolicy` (6).
- `constants.test.ts` (4), `initialSnapshot.test.ts` (2), `devLog.test.ts` (2), `fakeVideoPlayer.test.ts` (4).

Total new tests added by this increment: **615 − 391 = 224** (378 baseline after Increment 0's own additions, but comparing suite counts: 57 − 44 = 13 new suites, matching the 13 tasks' test files exactly — `constants`, `initialSnapshot`, `devLog`, `clamp`, `formatTime`, `selectCue`, `currentChapter`, `classifyError`, `retryPolicy`, `playbackReducer`, `fakeVideoPlayer`, `PlaybackEngine`, `usePlaybackEngine`).

## Deviations and notes

All deviations were caught by running the plan's own tests, not introduced independently. None weaken a test to make it pass; each either fixes a genuine defect in the code the test exercises, or fixes a defect in the test fixture itself, with the fix explained inline as a comment and in the commit message.

1. **Real engine bug found by the reducer's invariant sweep (Task 7).** `sourceLoaded` updated `durationMs` without reclamping `positionMs`, so a shrinking duration could leave the position past the end — violating the reducer's own `positionMs <= durationMs` invariant. Fixed by running `positionMs` through `clampPosition` whenever `sourceLoaded` changes `durationMs`.

2. **Real engine bug found by `PlaybackEngine.test.ts` E8 (Task 11).** `notifyAppState` called `player.pause()` *before* dispatching the `appBackground` event. The fake (and potentially a real native bridge) emits `playingChange` synchronously from `pause()`, so by the time `appBackground` was dispatched the reducer already saw status `"paused"` and cleared `isPlayingBeforeBackground`, losing the flag the background/resume flow depends on. Fixed by dispatching `appBackground` first, while status still reflects the real pre-pause state, then calling `pause()` only if it was genuinely playing or buffering.

3. **Two test-fixture gaps in `PlaybackEngine.test.ts` (Task 10), not engine defects.** The fake never advances simulated playback on its own, so long `jest.advanceTimersByTime()` calls without interleaved `tick()`s exercised timers unrelated to what the test named: "setSource during a pending retry cancels it" needed `becomeReady()` for the second source so its own load timer didn't fire an unrelated retry cascade; "readyToPlay before the timeout cancels it" needed periodic ticks so the independent stall timer (2s) didn't fire before the 30s window the test was actually checking (the load timer, 15s).

4. **One test-value mismatch (Task 11).** S15 ("ten rapid seeks") asserted `status === "paused"`, but its `ready()` helper defaults to `autoplay: false`, which leaves status `"ready"` (never played). Corrected the expected value to `"ready"`.

5. **One Babel/jest-hoist restriction (Task 12).** `usePlaybackEngine.test.tsx`'s `jest.mock("expo-video", ...)` factory referenced an out-of-scope `fake` variable; Babel's jest-hoist plugin rejects that unless the variable name is prefixed with `mock`. Renamed to `mockFake` throughout — no behavioural change.

6. **One test-fixture gap in `usePlaybackEngine.test.tsx` (Task 12).** "uses the latest onPositionChange callback" didn't account for the automatic first-report edge documented by the F15 test above it (entering `"playing"` at position 0 is always "due", since `0 - (-Infinity) >= POSITION_REPORT_INTERVAL_MS`). The initial callback (`first`) was therefore called once by that edge before the rerender the test meant to check. Cleared the mock after `becomeReady()`, before the rerender.

7. **`jest.testPathIgnorePatterns` etc. from Increment 0 remain in effect** and needed no changes this increment.

## File budget

Every new file is at or under the plan's 200-line default except two the plan itself exempts and one it does not:

| File | Lines | Budget | Status |
|---|---|---|---|
| `playbackReducer.ts` | 181 | ≤ 300 (explicit exemption) | OK |
| `PlaybackEngine.ts` | 501 | 200 default; **no exemption listed** | **Over budget** |
| everything else new | ≤ 124 | 200 | OK |

**Flagging this rather than resolving it silently, per CLAUDE.md §2.1.** The Global Constraints in the plan index state a 200-line default with exactly two named exceptions (`Player.tsx` ≤ 250, `playbackReducer.ts` ≤ 300); `PlaybackEngine.ts` is not one of them. But Task 9 prescribes this exact 501-line class verbatim as the required implementation, and Tasks 10–11 extend it by name across two more tasks without ever proposing a split. R9 (the invariant that would enforce the budget) is also *not* among the rules Task 13 activates — only R3 and R6 are. This looks like an oversight in the plan's own bookkeeping rather than a deliberate instruction to split the class before Increment 1 ends. Splitting `PlaybackEngine.ts` now would mean restructuring a class that Increment 2 (platform adapters) and Increment 3 (UI) are written against by its current shape; I left it as specified and record the conflict here for a human decision — e.g. add `PlaybackEngine.ts` to the exemption list explicitly, or schedule a split (event-handler methods vs. commands vs. timer/retry logic look like natural seams) as a follow-up task before Increment 4 depends on more of its surface.

## Performance

Not applicable: no UI yet, per the plan. P6 (timers cleared after unmount) is proven by `usePlaybackEngine.test.tsx`'s S11/S12/S20 test (`jest.getTimerCount()` is 0 after `unmount()`) and by `PlaybackEngine.test.ts`'s dispose test (`jest.getTimerCount()` is 0 after `dispose()`).

## Not done

- Nothing from the plan's 13 tasks was skipped.
- The two real bugs found (items 1 and 2 above) were fixed as part of the task that found them, per the plan's own instruction ("Modify ... only if a test fails").
- The `PlaybackEngine.ts` file-budget conflict (above) is left open for a decision rather than resolved unilaterally.
