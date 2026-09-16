# 10 — Migration and Swap Runbook

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 10 |
| ADR | 0001 |
| Branching | one branch per increment: `feature/player-0-baseline`, `feature/player-1-engine`, … `feature/player-7-cleanup`; merge to `main` only when the increment's exit criteria are recorded |
| Plans | one implementation plan per increment under `docs/superpowers/plans/2026-09-16-video-player-0<n>-<name>.md`, produced by the writing-plans skill from this document and the specs |

## 1. Increment order and exit criteria

| Inc | Name | Builds | Touches old code? | Exit criteria (all required) |
|---|---|---|---|---|
| 0 | Baseline | `npm install`; `jest.web.config.js` + `test:web` script; `__tests__/harness` mocks for orientation/brightness/haptics; `expo-brightness` installed; `__tests__/player/invariants.test.ts` (R1, R2, R7 active); parity characterization tests extended (§3) against the OLD player; baselines P4, P5, P8 (and P1/P2 if a device is available) recorded in `docs/player/baselines/` | tests only | `npm test` green; baseline table committed; `npx expo-doctor` clean after the new dependency |
| 1 | Engine | `components/VideoPlayer/{constants,tokens}.ts`, `engine/**` | no | all §3.1 tests green; R3 activated; reducer table coverage 100 percent of non-ignored cells |
| 2 | Platform | `platform/**`, `app.json` iOS `UIBackgroundModes: ["audio"]` | no | §3.2 tests green on both Jest projects; R4 activated; per-platform notes for PiP support recorded |
| 3 | UI and gestures | `ui/**`, `gestures/**` | no | §3.3 tests green; R5, R6 activated; accessibility checklist ticked per component |
| 4 | Composition root | `components/VideoPlayer/Player.tsx`, `types.ts`, `hooks/**` | no (`index.tsx` untouched) | §3.4 tests green incl. parity suite against `Player.tsx` and P4 perf test |
| 5 | Actions and services | `components/Video/actions/**`, `services/videoActions/**`, `services/storage/downloadsStorage.ts`, `constants/config.ts` additions, `app/_layout.tsx` provider line | moves files out of `components/VideoPlayer/modals` and `VideoActionBar.tsx` via `git mv`; the OLD `index.tsx` imports are updated to the new paths **only** for the moved modals/action bar so the old player keeps compiling — this is the single permitted edit to the old root before the swap, and it is import-path only | §3.5 tests green; old player still renders (characterization tests green) |
| 6 | Swap | `index.tsx` → re-export; `VideoPlaybackContainer.tsx` → new props + action bar + `file://`; `app/video/[id].tsx` passes `isFullscreen`; `__tests__/components/VideoPlaybackContainer.test.tsx`, `__tests__/screens/VideoScreen.test.tsx` updated; manual matrix run | yes: `index.tsx` replaced | `npm test`, `npm run test:web`, `npm run lint`, `npx tsc --noEmit` green; manual matrix recorded (at least Android + iOS, one device each; web if available); rollback rehearsed once (§5) |
| 7 | Cleanup | move old files to `docs/history/videoplayer/2026-09-16-pre-redesign/`; delete `hooks/useVideoProgress.ts`, `services/videoActionsService.ts` (moved to history too); flip flags per §6; update CLAUDE.md §1, `docs/engineering/video-player.md`, `docs/reference/Project-structure-of-expo-live-player.md`; invariants widened to the whole folder | removes old code | R1–R9 green over the whole folder; docs updated; final report with performance table |

## 2. Rules during the build (Increments 0–5)

1. `components/VideoPlayer/index.tsx` is byte-identical to `main` (invariants test) except the Increment 5 import-path edit for moved files, which is reviewed as its own commit titled `refactor(player): repoint old root at relocated action modules`.
2. New code lives only in the new folders. No new file is added at the root of `components/VideoPlayer/` except `Player.tsx`, `types.ts`, `constants.ts`, `tokens.ts`.
3. The app never imports `Player.tsx` before Increment 6 (R1 plus a grep for `VideoPlayer/Player` outside tests).
4. `components/Shorts/` and `hooks/useShortsPlayer.ts` are never touched (R7).
5. Every commit passes `npm test` and `npx tsc --noEmit` with no new errors.

## 3. Parity checklist (what the new player must reproduce before the swap)

Each row is a characterization test written in Increment 0 against the old player (`__tests__/player/VideoPlayer.render.test.tsx` extended) and re-expressed in Increment 4 against `Player.tsx` (`__tests__/player/VideoPlayer.parity.test.tsx`). Where the new behaviour intentionally differs, the row says so and the new test asserts the new behaviour.

| # | Behaviour today | New player | Intentional change? |
|---|---|---|---|
| C1 | Renders with an MP4 source without throwing | same | no |
| C2 | Renders with an HLS source | same | no |
| C3 | Mounts one expo-video `VideoView` with `nativeControls={false}`, `allowsFullscreen={false}` | same | no |
| C4 | Autoplay on by default; `autoplay={false}` starts paused | same | no |
| C5 | Previous/Next buttons present; disabled when no neighbour | same | no |
| C6 | Pressing Next/Previous calls the callbacks | same | no |
| C7 | Minimize button present; calls `onToggleMinimize` | same, plus a real mini-player view | additive |
| C8 | Autoplay toggle present; shows "Autoplay is on/off" notification | same via toast; state lifted to the app through `onToggleAutoplayNext` (today it is local state that does nothing) | yes: toggle now affects behaviour |
| C9 | Fullscreen button toggles; `onFullscreenChange` called with true/false | same; no Modal | yes: no remount |
| C10 | Progress bar and time label below the video when not fullscreen/minimized and `videoId` set | progress bar and time label are inside the overlay bottom row; always present in inline and fullscreen | yes: layout |
| C11 | Action bar below the video (Like, Dislike*, Share, Download*, Clip*, Save, More) | rendered by the container below the player | yes: ownership |
| C12 | Save sheet uses `SavedContext` | same (relocated) | no |
| C13 | Share sheet uses system share with the deep link | same (relocated) | no |
| C14 | Flags hide Dislike, Download, Clip, Report, Quality | same flags, same defaults until Increment 7 | no |
| C15 | Double-tap seeks ±10 s | same, zones from layout | fix (D14) |
| C16 | Controls auto-hide after 3.5 s when playing; stay when paused | same | no |
| C17 | Orientation locks landscape in fullscreen, portrait on exit | same via adapter | no |
| C18 | Status bar hidden in fullscreen | same | no |
| C19 | `onVideoFinished` when the video ends and autoplay-next is on with a next video | `onFinished` after the 5 s countdown (today: 1 s delay, no UI) | yes: countdown UI |
| C20 | Video letterboxed with `contain` inline; `fill` in fullscreen | `contain` everywhere | yes (D22) |
| C21 | Inline height ≈ 30.4 percent of window height capped by 16:9 | same constant | no |

## 4. Swap procedure (Increment 6, step by step)

1. Branch `feature/player-6-swap` from `main` after Increment 5 merged.
2. Replace `components/VideoPlayer/index.tsx` content with:
   ```ts
   export { Player as default } from "./Player";
   export type { VideoPlayerProps, VideoPlayerSource } from "./types";
   export type { PlaybackSnapshot, PlaybackStatus, PlaybackError } from "./engine/types";
   ```
3. Update `components/Video/VideoPlaybackContainer.tsx` per `03-architecture.md` §4.16: new props mapping, `useVideoActionsDeps().downloads.resolveLocalUri`, render `VideoActionBar` when `!isFullscreen && !isMinimized`, keep analytics.
4. Update `app/video/[id].tsx` to pass `isFullscreen` to the container (it already holds the state).
5. Update `__tests__/components/VideoPlaybackContainer.test.tsx` and `__tests__/screens/VideoScreen.test.tsx`; delete the old `__tests__/player/VideoPlayer.render.test.tsx` characterization file only in Increment 7 (in Increment 6 it is retargeted: the old player is gone from `index.tsx`, so the parity suite replaces it — move the file to history with the old code).
6. Run the gate (`09-test-plan.md` §5).
7. Run the manual matrix on one Android and one iOS device; record results in `docs/superpowers/plans/2026-09-XX-video-player-06-swap-report.md`.
8. Rehearse rollback (§5) on the branch once, then re-apply.
9. Merge.

## 5. Rollback

- Before Increment 7: `git revert <swap-commit>` restores the old `index.tsx` and the old container. The old files are still in place, so the app works immediately. Run `npm test` to confirm.
- After Increment 7: `git revert <cleanup-commit> <swap-commit>` (two commits). The old files return from history and the flags return to their previous values.
- The flags table (§6) is part of the cleanup commit so it reverts with it.

## 6. Feature flags after Increment 7

| Flag | Value | Condition |
|---|---|---|
| `download` | `true` | F33 tests green and M23 passed on Android and iOS |
| `pictureInPicture` | `true` | F21 tests green and M19 passed on at least one platform |
| `qualitySelection` | `false` | library limitation (F24) |
| `clipEditor` | `true` | F34 tests green |
| `thanks` | `false` | human decision on showing the teaser (ADR 0009) |
| `report` | `true` | F35 tests green |
| `dislike` | `true` | F30 tests green |

If a manual condition was not run, the flag stays `false` and the report says so.

## 7. Documents to update in Increment 7

| File | Change |
|---|---|
| `CLAUDE.md` §1 | Replace the file list sentence with the new structure (`Player.tsx`, `engine/`, `platform/`, `gestures/`, `ui/`, `hooks/`, `constants.ts`, `tokens.ts`, `types.ts`); state that app actions live in `components/Video/actions/`; note the invariant test file |
| `docs/engineering/video-player.md` | Add "Architecture" section pointing to `docs/player/03-architecture.md`; add R1–R9 as rules; keep the protected-module workflow |
| `docs/reference/Project-structure-of-expo-live-player.md` | Rewrite section 1 (structure) and section 2 (capabilities: expo-video, not expo-av) to the new reality |
| `docs/reference/expo-live-player-architecture-issue.md` | Append "Resolved by the 2026-09-16 redesign" notes to Issues A, B, D, E |
| `docs/player/01-current-player-issue-register.md` | Mark each D-row "Retired at S7" |
| `docs/player/adr/0012-*.md` | Fill measured numbers; keep status until the human confirms |

## 8. Definition of done for the whole effort

- All seven increments merged with reports.
- `npm test`, `npm run test:web`, `npm run lint` (0 errors), `npx tsc --noEmit` (no errors in player, actions, services; pre-existing Comments/Shorts errors unchanged and listed).
- Invariants R1–R9 green over `components/VideoPlayer/`.
- Manual matrix recorded with real device identifiers; unrun rows marked "not run".
- Performance table filled against ADR 0012 with measured values or explicit "not measured".
- Open items O1–O6 either answered by the human or still listed as open in the final report.
