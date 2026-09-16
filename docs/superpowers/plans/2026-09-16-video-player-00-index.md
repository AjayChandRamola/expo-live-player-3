# Video Player Redesign — Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, **inline in the current session**. CLAUDE.md section 0 forbids subagent-driven development for this project. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the polling-based, 1,111-line `components/VideoPlayer/index.tsx` with a lean, event-driven, app-agnostic player for Android, iOS and web, and move app actions out of the player, without breaking the running app at any commit.

**Architecture:** Parallel rebuild behind `components/Video/VideoPlaybackContainer.tsx` (ADR 0001). New code lands in new subfolders of `components/VideoPlayer/` while the old flat files stay live; a one-commit swap re-points `index.tsx`; cleanup retires the old files.

**Tech Stack:** Expo SDK 54.0.22, React Native 0.81.4, React 19.1.0, expo-video ~3.0.11, react-native-reanimated ~4.1.1, react-native-gesture-handler ~2.28.0, expo-file-system ~19.0.17 (legacy subpath), expo-brightness 14.0.x (new), TypeScript ~5.9.2 strict, Jest 29 + jest-expo 54 + RNTL 13.

**Spec:** `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md`. Detailed documents: `docs/player/README.md` (index), `01`–`10`, `adr/0001`–`0012`.

## Global Constraints (apply to every task in every plan)

1. **Inline execution only.** No subagents for implementation, review, or testing.
2. **Pinned versions.** Do not upgrade Expo, React Native, React, expo-video, Reanimated, or gesture-handler. The only new dependency is `expo-brightness`, installed with `npx expo install expo-brightness` (ADR 0010).
3. **Verified scripts only:** `npm test`, `npm run test:web` (added in Increment 0), `npm run lint`, `npx tsc --noEmit`, `npx expo-doctor`, `npx expo export`. Never invent a script or a result.
4. **Test first.** Every task writes the failing test, runs it red, implements, runs it green, commits.
5. **Strict TypeScript.** No `any`, `as any`, `@ts-ignore`, `@ts-nocheck`, unused imports, or dead code in new or touched files.
6. **Constants, not numbers.** Every timing, size, threshold, and message comes from `components/VideoPlayer/constants.ts` or `constants/config.ts`. Numeric literals other than 0, 1, 2 in arithmetic are a review failure.
7. **Old code is frozen.** `components/VideoPlayer/index.tsx` and the other old flat files are not edited before Increment 6, except the import-path-only edit in Increment 5 Task "Repoint old root". `components/Shorts/` and `hooks/useShortsPlayer.ts` are never edited (R7).
8. **Import rules R1–R9** (`docs/player/03-architecture.md` §2) are enforced by `__tests__/player/invariants.test.ts`; it must pass at every commit once created.
9. **Logging.** Player code logs only through `engine/devLog.ts` (dev-only). Never log a URL query string, a header, or personal data.
10. **Commit messages** follow `type(scope): summary`, include a `Verified:` line with the command and its observed output, and end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
11. **Reports.** Each increment ends with `docs/superpowers/plans/2026-09-16-video-player-0<n>-report.md` using the template in `docs/player/08-reliability-and-performance.md` §6, stating exactly what was run, what passed, what was not run.
12. **File budgets** (R9): every new file under 200 lines except `Player.tsx` (≤ 250), `playbackReducer.ts` (≤ 300), and `PlaybackEngine.ts` (≤ 550 — subscription wiring, timer/retry state machine and command validation for one native player; Increment 1 built it at 501 lines per Task 9's verbatim spec and Tasks 10-11 extend it directly. Exempted after the fact, decided during Increment 1's report review, rather than split code Increments 2-3 already depend on by shape). Split before exceeding a file's budget.

## Plans

| Increment | Plan file | Branch | Depends on |
|---|---|---|---|
| 0 Baseline | `2026-09-16-video-player-01-baseline.md` | `feature/player-0-baseline` | — |
| 1 Engine | `2026-09-16-video-player-02-engine.md` | `feature/player-1-engine` | 0 |
| 2 Platform adapters | `2026-09-16-video-player-03-platform.md` | `feature/player-2-platform` | 1 |
| 3 UI and gestures | `2026-09-16-video-player-04-ui-gestures.md` | `feature/player-3-ui` | 1, 2 |
| 4 Composition root | `2026-09-16-video-player-05-root.md` | `feature/player-4-root` | 1, 2, 3 |
| 5 Actions and services | `2026-09-16-video-player-06-actions.md` | `feature/player-5-actions` | 0 (independent of 1–4; may run in parallel on its own branch) |
| 6 Swap | `2026-09-16-video-player-07-swap.md` | `feature/player-6-swap` | 4, 5 |
| 7 Cleanup | `2026-09-16-video-player-08-cleanup.md` | `feature/player-7-cleanup` | 6 |

Each plan is complete on its own. Read the plan, the spec section it names, and the `docs/player/` document it names before starting.

## Shared conventions used by every plan

- **Test file placement:** `__tests__/player/**` for player code, `__tests__/components/actions/**` for action UI, `__tests__/services/videoActions/**` for services. Test files import with relative paths (`../../../components/VideoPlayer/...`), matching the existing tests.
- **Fakes:** `__tests__/player/fakes/` holds `fakeVideoPlayer.ts`, `fakeAdapters.ts`, `snapshots.ts`, `fakeEngineHook.ts`. They are created in the increment that first needs them and reused afterwards.
- **Running one test file:** `npm test -- --testPathPattern=<pattern>` (Jest 29 accepts `--testPathPattern`; if the installed Jest rejects it, use `npm test -- <path>`).
- **Type check:** `npx tsc --noEmit 2>&1 | grep -v "__tests__\|components/Comments\|GlobalErrorLogger\|ShortsSearchBar\|useVoiceSearch" | grep "error TS"` must print nothing (the excluded paths carry the 18 pre-existing errors and the missing-dependency errors fixed in Increment 0 Task 1; after Task 1, drop the `__tests__` exclusion).
