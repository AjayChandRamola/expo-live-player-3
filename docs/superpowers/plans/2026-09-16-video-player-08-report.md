# Increment 7 — Cleanup Report and Final Summary

## Gate

- `npm test` → **95 suites passed, 778 tests passed**
- `npm run test:web` → **8 suites passed, 39 tests passed**
- `npx tsc --noEmit` → **24 errors** (matches the pre-existing project baseline exactly; none introduced by this increment or the whole redesign effort)
- `npm run lint` → **1 pre-existing error** (`expo-speech` unresolved module, unrelated to this work), 349 warnings
- Invariants over the whole `components/VideoPlayer` folder: **R1–R9 passing** (10 tests in `__tests__/player/invariants.test.ts`), including the two timer rules that replaced the single combined check.

## What this increment did

1. **Retired the pre-redesign player files** (`AutoplayNotification.tsx`, `AutoplayToggle.tsx`, `FullscreenButton.tsx`, `MinimizeButton.tsx`, `NextVideoButton.tsx`, `PlayPauseButton.tsx`, `PreviousVideoButton.tsx`, `usePlayPauseController.ts`, `VideoProgressBar.tsx`, `VideoTimeOverlay.tsx`, `hooks/useVideoProgress.ts`, `hooks/useVideoActions.ts`, `services/videoActionsService.ts`, and their test) to `docs/history/videoplayer/2026-09-16-pre-redesign/` via `git mv`, plus a captured copy of the pre-swap `index.tsx`. `components/VideoPlayer` now contains exactly `Player.tsx`, `constants.ts`, `engine/`, `gestures/`, `hooks/`, `index.tsx`, `platform/`, `tokens.ts`, `types.ts`, `ui/` — the expected final structure. One obsolete test (`SaveSheet.test.tsx`'s "no longer reaches the playlist service", which `require()`d the now-retired service directly) was removed since the assertion became meaningless once the module no longer exists.
2. **Widened the architecture invariants** (R3–R6, R9) from the new-code subfolders to the whole player tree, since there is no longer an "old" part of the folder to exempt. Also split the combined timer check into the plan's two more precise rules, and tightened R3's `expo-video` check to runtime imports only (`Player.tsx` has a type-only `import type { VideoView } from "expo-video"`, which is architecturally fine).
3. **Flipped feature flags** per the plan's evidence rule (a flag flips to `true` only if its acceptance tests are green *and*, where the plan requires it, its manual matrix row was actually run and passed):

## Flags after this increment

| Flag | Value | Evidence |
|---|---|---|
| `download` | `false` | F33 tests green, but manual matrix row M23 **not run** (no device available in Increment 6) |
| `pictureInPicture` | `false` | F21 tests green, but manual matrix row M19 **not run** (no device available in Increment 6) |
| `clipEditor` | `true` | F34 tests green; no manual matrix dependency |
| `report` | `true` | F35 tests green; no manual matrix dependency |
| `dislike` | `true` | F30 tests green; no manual matrix dependency |
| `qualitySelection` | `false` | Never enabled in this effort — expo-video 3.0.11's `videoTrack` is read-only |
| `thanks` | `false` | Human decision on the teaser is still pending (ADR 0009) |

Note: this differs from `docs/player/02-feature-catalog.md`'s §"Rule" line and `10-migration-and-swap.md`'s flag table, both of which assumed `download` and `pictureInPicture` would flip to `true` "after Increment 7." Those documents were written before it was known that no device would be available to run M19/M23 in this environment. The plan's own global constraint for Increment 7 ("a flag flips to `true` only if ... its manual matrix row run and passed") takes precedence, so both flags correctly stayed `false`. `02-feature-catalog.md` and `10-migration-and-swap.md` were not edited to match, since Task 4's file list does not include them — flagged here as a documentation follow-up (see "Not done" below).

4. **Documentation updates** describing the redesigned structure: `CLAUDE.md` §1, `docs/engineering/video-player.md` (new architecture section with R1–R9), `docs/reference/Project-structure-of-expo-live-player.md` (rewritten tree, `expo-av` → `expo-video ~3.0.11`), `docs/reference/expo-live-player-architecture-issue.md` (resolution notes on Issues A, B, D, E), `docs/player/01-current-player-issue-register.md` (a "Retired" column on every D-row, marked with the retirement commit sha `98f44e0`; E1 marked "Resolved in Increment 0"), and `docs/player/adr/0012-performance-targets-pending-confirmation.md` (measured P1–P9 table from the Increment 6 report; status stays "Proposed" pending O1).

## Performance (ADR 0012)

| Id | Target | Baseline (old) | Measured (new) | Device | Pass |
|----|--------|-----------------|-----------------|--------|------|
| P1 | ≤ 2,000 ms | not measured (no device, Increment 0) | not measured | no device | not measured |
| P2 | ≤ 3,000 ms | not measured (no device, Increment 0) | not measured | no device | not measured |
| P3 | ≤ 100 ms | not measured (no device, Increment 0) | not measured | no device | not measured |
| P4 | ≤ 4 renders/s | not measured (no device, Increment 0) | automated proxy passing (Jest) | CI (fake timers) | yes (proxy only; device profiler never run in this effort) |
| P5 | ≤ 30 MB growth | not measured (no device, Increment 0) | not measured | no device | not measured |
| P6 | 0 timers/listeners after unmount | passing (S20 suite, since Increment 1) | passing (S20 suite) | CI | yes |
| P7 | JS FPS ≥ 55 | not measured (no device, Increment 0) | not measured | no device | not measured |
| P8 | ≥ 40% smaller bundle | not measured (no device/CI run, Increment 0) | not measured | no device/CI run | not measured |
| P9 | no worse battery | not measured (no device, Increment 0) | not measured | no device | not measured |

No physical device was available in any increment of this effort (Increment 0 through 7), so the device-dependent performance targets (P1, P2, P3, P5, P7, P8, P9) were never measured against either the old or the new player. Only the two CI-measurable proxies (P4's render-budget test, P6's resource-cleanup suite) have evidence, and both pass.

## Open items for the human

| Id | Item | Status |
|---|---|---|
| O1 | Confirm/change device baseline and targets | Still open — implemented and will be measured against the proposed table once a device is available; no change requested during this effort. |
| O2 | Engine auto-resume on foreground (rule L4)? | Still open — default (no auto-resume) in effect throughout. |
| O3 | Remove `react-native-paper` from `package.json` after S7? | Still open — kept per default; not addressed by this increment (no importers were removed as part of Increment 7's scope). |
| O4 | Android immersive navigation bar in fullscreen | Still open — not added, per default (status bar only). |
| O5 | Now-playing notification / background audio | Still open — both off, per default. |
| O6 | Web browsers in manual matrix | Answered by default in Increment 6: Chrome and Safari, current stable, desktop and mobile. |

## Not done / limitations

- **The full manual device matrix (M1–M27)** has never been run in this effort — no physical Android or iOS device, and no interactive Chrome/Safari session, was available in this environment at any point from Increment 0 through 7. `download` and `pictureInPicture` correctly remain `false` as a direct consequence.
- **Device-level performance measurements** P1, P2, P3, P5, P7, P8, P9, and the device-profiler half of P4 — none were ever measured, old or new player, for the same reason.
- **O1–O5 remain open** pending human decisions; none were answered or changed in this increment.
- **`docs/player/02-feature-catalog.md` and `docs/player/10-migration-and-swap.md`** still describe a flag table that assumes `download`/`pictureInPicture` flip to `true` "after Increment 7." That assumption predates the no-device constraint discovered during Increment 6 and was not corrected in this increment (outside Task 4's file list) — a follow-up documentation fix is needed to avoid confusing a future reader.
- **`react-native-paper`** (O3) was not removed from `package.json`; no importer audit was performed as part of this increment's scope.

## Definition of done

Per `docs/player/10-migration-and-swap.md` §8: automated gate green (confirmed above), manual matrix recorded (recorded as not run, no device, per the plan's fallback), rollback rehearsed (done in Increment 6), flags flipped only with evidence (done, with two correctly held back), documentation updated (done). The whole video player redesign effort (Increments 0–7) is complete under these terms; the not-run manual matrix and unmeasured device performance targets are open follow-up work for whenever a physical device becomes available, not gaps in this increment's own scope.
