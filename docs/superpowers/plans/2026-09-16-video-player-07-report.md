# Increment 6 (Swap) — Report

## Summary

`components/VideoPlayer/index.tsx` now re-exports the `Player` composition root built in Increment 4. `VideoPlaybackContainer` maps domain `Video`/`PlayableSource` onto `VideoPlayerProps`, prefers a downloaded local file over the network URL, and renders `VideoActionBar` when not fullscreen or minimized. `app/video/[id].tsx` passes `isFullscreen` and wires `onToggleAutoplay` to both `PlayQueueContext.setAutoplay` and `SettingsContext.setAutoplayDefault`. The swap and container update landed in one commit, with `OLD_ROOT_FROZEN` removed from the invariant suite's `ACTIVE_RULES` in the same commit, per the plan's global constraint.

## Gate (swapped state, after Task 2's commit)

- `npm test` → **96 suites passed, 779 tests passed**
- `npx tsc --noEmit` → **24 errors** (matches the pre-existing project baseline exactly; none introduced by this increment)
- `npm run lint` → **1 pre-existing error** (`expo-speech` unresolved module, unrelated to this work), 410 warnings

## Deviations from the plan (all necessary to keep the gate green)

1. **`components/Live/LiveHero.tsx`** — a second consumer of `VideoPlaybackContainer` not listed in the plan's file list (the Live tab's hero player). It needed the two new required props (`isFullscreen`, `onToggleAutoplay`) added with no-op/false defaults matching its existing pattern; without this, `tsc` regressed by one error.
2. **Dead compatibility aliases removed**: `VideoSaveSheet`/`VideoShareSheet` re-exports in `SaveSheet.tsx`/`ShareSheet.tsx` were left over from Increment 5's Task 10 repoint and had no remaining importers (verified by grep). Removed along with three stale docblock comments (`SaveSheet.tsx`, `ShareSheet.tsx`, `VideoActionButton.tsx`) that still referenced the old `components/VideoPlayer/modals/...` paths — surfaced by the plan's own Task 2 Step 4 grep check.
3. **`docs/history/**` excluded from both Jest (`testPathIgnorePatterns`) and ESLint (`ignores`)**: the archived pre-redesign characterization test (`VideoPlayer.render.test.tsx`, moved via `git mv`) is incompatible with the new player and its relative imports no longer resolve from the archived location. Both tools scan by default regardless of the other's config, so both needed the exclusion.

## Rollback rehearsal (Task 3)

- `git revert --no-edit HEAD` on the swap commit (`1635eda`) → `npm test` → **97 suites passed, 799 tests passed** (pre-swap state: old root restored, old container test restored).
- `git revert --no-edit HEAD` again (revert of the revert) → `npm test` → **96 suites passed, 779 tests passed**, `npx tsc --noEmit` → 24 errors (swap state restored exactly).

**Result: rollback rehearsed successfully.** Reverting the swap commit cleanly restores the pre-swap player and its test suite to green; reverting that revert cleanly restores the swapped state to green. A production rollback is a single `git revert` of the swap commit, consistent with ADR 0001.

## Manual device matrix (Task 4)

No physical Android or iOS device, and no Chrome/Safari manual session, was available in this environment. Per the plan's explicit fallback, every row is recorded as **not run (no device)**.

| # | Check | Android low-end | iOS | Chrome | Safari |
|---|---|---|---|---|---|
| M1 | Play MP4 from Home | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M2 | Play HLS VOD | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M3 | Play HLS live | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M4 | Rotate to landscape mid-play | not run (no device) | not run (no device) | not run (no device) | n/a |
| M5 | Exit fullscreen (button, back, Escape) | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M6 | Background during play, return | not run (no device) | not run (no device) | n/a | n/a |
| M7 | Lock screen, unlock | not run (no device) | not run (no device) | n/a | n/a |
| M8 | Incoming call | not run (no device) | not run (no device) | n/a | n/a |
| M9 | Navigate away mid-play | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M10 | Autoplay-next countdown | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M11 | Airplane mode mid-play | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M12 | Throttled network | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M13 | Double-tap left/right/centre | not run (no device) | not run (no device) | n/a | n/a |
| M14 | Brightness and volume swipes | not run (no device) | not run (no device) | not run (no device — web CSS only) | not run (no device — web CSS only) |
| M15 | Long press | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M16 | Scrub and chapter tap | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M17 | Captions from prop and embedded track | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M18 | Speed change | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M19 | PiP | not run (no device) | not run (no device) | not run (no device) | n/a |
| M20 | Mini-player | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M21 | Keyboard shortcuts | n/a | n/a | not run (no device) | not run (no device) |
| M22 | Like/Dislike/Save/Share | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M23 | Download MP4, airplane mode, play | not run (no device) | not run (no device) | n/a | n/a |
| M24 | Report, Not interested | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M25 | Thanks | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M26 | Shorts tab | not run (no device) | not run (no device) | not run (no device) | not run (no device) |
| M27 | Screen reader pass (TalkBack / VoiceOver) | not run (no device) | not run (no device) | not run (no device) | not run (no device) |

**Consequence per the plan's explicit rule:** the swap still merges on the automated gate, but Increment 7 must not flip `download` or `pictureInPicture` to `true` until M19 (PiP) and M23 (download) are actually run on a device.

## Performance (P1–P9, new player vs. Increment 0 baseline)

No device was available to measure P1, P2, P4 (device profiler pass), P5, P7, P8, or P9 in this environment. P4's automated proxy (`__tests__/player/VideoPlayer.root.perf.test.tsx`, added in Increment 4) continues to pass as part of the 779-test suite, but that is a Jest-level render-budget check, not the device-level P4 measurement.

| Id | Target | Measured | Device / condition | Pass |
|----|--------|----------|--------------------|------|
| P1 | ≤ 2,000 ms (MP4 first frame) | not measured | no device | not measured |
| P2 | ≤ 3,000 ms (HLS first frame) | not measured | no device | not measured |
| P3 | ≤ 100 ms (tap to dispatch) | not measured | no device | not measured |
| P4 | ≤ 4 renders/s while playing | automated proxy passing (Jest) | CI (fake timers) | yes (proxy only; device profiler not run) |
| P5 | ≤ 30 MB growth / 10 source changes | not measured | no device | not measured |
| P6 | 0 timers/listeners after unmount | passing (S20 suite) | CI | yes |
| P7 | JS FPS ≥ 55 during fade | not measured | no device | not measured |
| P8 | ≥ 40% smaller bundle contribution | not measured | no device/CI run | not measured |
| P9 | Battery no worse than baseline | not measured | no device | not measured |

## Open items O1–O6

| Id | Item | Status |
|---|---|---|
| O1 | Confirm/change device baseline and targets | Still open — implemented and will be measured against the proposed table once a device is available; no change requested. |
| O2 | Engine auto-resume on foreground (rule L4)? | Still open — default (no auto-resume) in effect; unchanged this increment. |
| O3 | Remove `react-native-paper` after S7? | Still open — kept per default; no importers removed in this increment. |
| O4 | Android immersive navigation bar in fullscreen | Still open — not added, per default (status bar only). |
| O5 | Now-playing notification / background audio | Still open — both off, per default. |
| O6 | Web browsers in manual matrix | Answered by default: Chrome and Safari, current stable, desktop and mobile — reflected in the matrix table above. |

## Not done

- The full manual device matrix (M1–M27) — no physical device available in this environment.
- Device-level performance measurements P1, P2, P3, P5, P7, P8, P9 and the device-profiler half of P4.
- O1–O5 remain open pending human decisions; none were answered or changed in this increment.
- Increment 7 (cleanup) is not started.

## Files changed (swap commit `1635eda`, rehearsed via `7bc76ab` revert / `deb1a6d` reapply)

- `components/VideoPlayer/index.tsx` — re-exports `Player`
- `components/Video/VideoPlaybackContainer.tsx` — rewritten against new `VideoPlayerProps`
- `app/video/[id].tsx` — passes `isFullscreen`, wires `onToggleAutoplay`
- `__tests__/components/VideoPlaybackContainer.test.tsx`, `__tests__/screens/VideoScreen.test.tsx`, `__tests__/player/invariants.test.ts` — updated/rewritten tests
- `docs/history/videoplayer/2026-09-16-pre-redesign/__tests__/VideoPlayer.render.test.tsx` — archived via `git mv`
- `components/Live/LiveHero.tsx`, `components/Video/actions/VideoActionButton.tsx`, `components/Video/actions/sheets/SaveSheet.tsx`, `components/Video/actions/sheets/ShareSheet.tsx`, `eslint.config.js`, `package.json` — deviation fixes documented above
