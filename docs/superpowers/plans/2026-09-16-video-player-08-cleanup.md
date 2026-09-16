# Increment 7 — Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, inline in this session (CLAUDE.md §0 forbids subagents). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-09-16-video-player-00-index.md` first. Increment 6 must be merged.

**Goal:** Retire the old player files to history, widen the invariants to the whole player folder, flip the feature flags whose acceptance evidence exists, and update every document that describes the player's structure.

**Architecture:** Deletions and documentation only, plus `constants/config.ts` flag values. Rollback is `git revert` of this increment's commits together with the swap commit (ADR 0001).

**Spec:** `docs/player/10-migration-and-swap.md` §1 row 7, §6, §7; `docs/player/01-current-player-issue-register.md` retirement checklist.

## Global Constraints

See the index. Additionally:
- Files are moved with `git mv`, never deleted outright, so history and content remain reviewable under `docs/history/videoplayer/2026-09-16-pre-redesign/`.
- A flag flips to `true` only if the report from Increment 6 shows its acceptance tests green **and** its manual matrix row run and passed. Otherwise it stays `false` and the report says why.

---

### Task 1: Retire the old player files

**Files (git mv to `docs/history/videoplayer/2026-09-16-pre-redesign/`):**
```
components/VideoPlayer/AutoplayNotification.tsx
components/VideoPlayer/AutoplayToggle.tsx
components/VideoPlayer/FullscreenButton.tsx
components/VideoPlayer/MinimizeButton.tsx
components/VideoPlayer/NextVideoButton.tsx
components/VideoPlayer/PlayPauseButton.tsx
components/VideoPlayer/PreviousVideoButton.tsx
components/VideoPlayer/usePlayPauseController.ts
components/VideoPlayer/VideoProgressBar.tsx
components/VideoPlayer/VideoTimeOverlay.tsx
hooks/useVideoProgress.ts
hooks/useVideoActions.ts
services/videoActionsService.ts
__tests__/player/AutoplayNotification.test.tsx
```
Also capture the pre-swap `index.tsx` for the record: `git show <swap-sha>^:components/VideoPlayer/index.tsx > docs/history/videoplayer/2026-09-16-pre-redesign/index.tsx`.

- [ ] **Step 1: Confirm nothing imports them**

```bash
grep -rn "AutoplayNotification\|usePlayPauseController\|VideoProgressBar\|VideoTimeOverlay\|PreviousVideoButton\|NextVideoButton\|hooks/useVideoProgress\|hooks/useVideoActions\|videoActionsService" app components contexts hooks services --include=*.ts --include=*.tsx | grep -v "^components/VideoPlayer/\(AutoplayNotification\|AutoplayToggle\|FullscreenButton\|MinimizeButton\|NextVideoButton\|PlayPauseButton\|PreviousVideoButton\|usePlayPauseController\|VideoProgressBar\|VideoTimeOverlay\)\|^hooks/useVideoProgress\|^hooks/useVideoActions\|^services/videoActionsService"
```
Expected: nothing. If a hit appears, stop and report; do not move the file that is still imported.

Note: the old `components/VideoPlayer/modals/` folder should already be empty after Increment 5's moves; remove the empty directory if `git` left it.

- [ ] **Step 2: Move**

```bash
mkdir -p docs/history/videoplayer/2026-09-16-pre-redesign/__tests__
git show $(git log --format=%H --grep="swap to the redesigned player" -n 1)^:components/VideoPlayer/index.tsx > docs/history/videoplayer/2026-09-16-pre-redesign/index.tsx
for f in AutoplayNotification.tsx AutoplayToggle.tsx FullscreenButton.tsx MinimizeButton.tsx NextVideoButton.tsx PlayPauseButton.tsx PreviousVideoButton.tsx usePlayPauseController.ts VideoProgressBar.tsx VideoTimeOverlay.tsx; do git mv "components/VideoPlayer/$f" "docs/history/videoplayer/2026-09-16-pre-redesign/$f"; done
git mv hooks/useVideoProgress.ts docs/history/videoplayer/2026-09-16-pre-redesign/useVideoProgress.ts
git mv hooks/useVideoActions.ts docs/history/videoplayer/2026-09-16-pre-redesign/useVideoActions.ts
git mv services/videoActionsService.ts docs/history/videoplayer/2026-09-16-pre-redesign/videoActionsService.ts
git mv __tests__/player/AutoplayNotification.test.tsx docs/history/videoplayer/2026-09-16-pre-redesign/__tests__/AutoplayNotification.test.tsx
```
`tsconfig.json` already excludes `docs/history`, so the moved files leave the type-check.

- [ ] **Step 3: Gate and commit**

```bash
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
ls components/VideoPlayer
```
Expected: `components/VideoPlayer` contains only `index.tsx`, `Player.tsx`, `types.ts`, `constants.ts`, `tokens.ts`, `engine/`, `platform/`, `gestures/`, `hooks/`, `ui/`.

```bash
git add -A components/VideoPlayer hooks services docs/history __tests__
git commit -m "refactor(player): retire pre-redesign player files to docs/history

Verified: npm test => <N> suites passed
Verified: ls components/VideoPlayer => index.tsx Player.tsx types.ts constants.ts tokens.ts engine platform gestures hooks ui

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Widen invariants to the whole folder

**Files:**
- Modify: `__tests__/player/invariants.test.ts`

- [ ] **Step 1:** Change `NEW_FOLDERS`-scoped checks (R3, R4, R5, R6, R9) to run over `listFiles(PLAYER_DIR)` (the whole folder) and add a test:

```ts
it("no setInterval or setTimeout outside the engine, gestures and hooks folders", () => {
  const allowed = /components\/VideoPlayer\/(engine|gestures|hooks|ui\/BufferingIndicator\.tsx)/;
  const offenders = playerFiles
    .filter((f) => /\bset(Interval|Timeout)\(/.test(read(f)))
    .map(rel)
    .filter((r) => !allowed.test(r));
  expect(offenders).toEqual([]);
});
it("no setInterval anywhere in the player except useEndScreenCountdown", () => {
  const offenders = playerFiles.filter((f) => /\bsetInterval\(/.test(read(f))).map(rel).filter((r) => !r.endsWith("hooks/useEndScreenCountdown.ts"));
  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2:** Run `npm test -- --testPathPattern=invariants` → all pass. Commit: `test(player): widen invariants to the whole VideoPlayer folder`.

---

### Task 3: Feature flags

**Files:**
- Modify: `constants/config.ts` (`PLAYER_FEATURE_FLAGS`)
- Modify: `__tests__/components/actions/VideoActionBar.test.tsx` if a default-flag assertion changes

- [ ] **Step 1: Decide each flag from the Increment 6 report**

| Flag | Set to `true` only if | Otherwise |
|---|---|---|
| `download` | F33 tests green **and** M23 run and passed on Android and iOS | `false`, note "M23 not run" |
| `pictureInPicture` | F21 tests green **and** M19 run and passed on at least one platform | `false` |
| `clipEditor` | F34 tests green | — |
| `report` | F35 tests green | — |
| `dislike` | F30 tests green | — |
| `qualitySelection` | never in this effort (library limitation) | `false` |
| `thanks` | human decision on showing the teaser (ADR 0009) | `false` |

- [ ] **Step 2: Apply and run**

Edit the object values accordingly; run `npm test` (the action-bar tests that assert hidden buttons under flags may need their default expectations updated — update the expectation to the new default, do not weaken the test's structure). Commit: `feat(actions): enable verified action flags (<list>)` with a `Verified:` line naming the matrix rows relied on.

---

### Task 4: Documentation updates

**Files:**
- Modify: `CLAUDE.md` §1
- Modify: `docs/engineering/video-player.md`
- Modify: `docs/reference/Project-structure-of-expo-live-player.md`
- Modify: `docs/reference/expo-live-player-architecture-issue.md`
- Modify: `docs/player/01-current-player-issue-register.md`
- Modify: `docs/player/adr/0012-performance-targets-pending-confirmation.md`

- [ ] **Step 1: CLAUDE.md §1** — replace the sentence beginning "Existing `VideoPlayer` (`components/VideoPlayer/`) is working and is the authoritative playback implementation. It is composed of many focused files (`index.tsx`, `Controls.tsx`, …" with:

> The `VideoPlayer` (`components/VideoPlayer/`) is the authoritative playback implementation, redesigned on 2026-09-16 (see `docs/player/README.md`). Structure: `index.tsx` (re-export), `Player.tsx` (composition root), `types.ts`, `constants.ts`, `tokens.ts`, `engine/` (event-driven playback engine and pure reducer), `platform/` (native and web adapters), `gestures/`, `hooks/` (root glue), `ui/` (controls and transient views). App actions (Like, Save, Share, Download, Clip, Report, Thanks) live in `components/Video/actions/` and persist through `services/videoActions/`. Dependency rules R1–R9 are enforced by `__tests__/player/invariants.test.ts`. Do not collapse folders or add files at the player root.

Also in §1: "Shared playback state lives in `contexts/VideoPlayerContext.tsx`" → replace with "Queue and autoplay state live in `contexts/PlayQueueContext.tsx`; playback state is internal to the player and reaches the app only through `onStateChange`/`onPositionChange`." (`VideoPlayerContext.tsx` no longer exists — verify with `ls contexts`.)

- [ ] **Step 2: `docs/engineering/video-player.md`** — add a section "## 7. Architecture (2026-09-16 redesign)" pointing to `docs/player/03-architecture.md`, listing R1–R9 verbatim, and stating: "Only the container imports the player. The player never imports contexts, services, hooks or app code. Only the engine and PlayerSurface import expo-video. No `Platform.OS` above `platform/`. Reanimated is the only animation library. No `any`. Shorts unchanged. File budgets apply."

- [ ] **Step 3: `docs/reference/Project-structure-of-expo-live-player.md`** — rewrite section 1 to the new tree (copy from `docs/player/03-architecture.md` §3) and section 2's "Playback library" row from `expo-av` to `expo-video ~3.0.11`. Remove references to `Controls.tsx`, `hooks/useVideoPlayer.ts`, `VideoView.tsx`, `contexts/VideoPlayerContext.tsx`.

- [ ] **Step 4: `docs/reference/expo-live-player-architecture-issue.md`** — under Issues A, B, D, E append one line each: "Resolved by the 2026-09-16 redesign: see ADR 0006 / PlayQueueContext / ADR 0011 / docs/player/03-architecture.md."

- [ ] **Step 5: Issue register** — mark every D-row "Retired at S7 (<commit sha>)" in a new final column, and E1 "Resolved in Increment 0".

- [ ] **Step 6: ADR 0012** — fill the measured P1–P9 values from the Increment 6 report; keep status "Proposed" until the human confirms the targets (open item O1).

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/engineering/video-player.md docs/reference docs/player
git commit -m "docs: describe the redesigned player structure and rules; retire issue register rows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Final report

Create `docs/superpowers/plans/2026-09-16-video-player-08-report.md`:

```markdown
# Increment 7 — Cleanup Report and Final Summary

## Gate
- npm test / test:web / lint / tsc: <numbers>
- invariants over the whole folder: R1–R9 + timer rules passing

## Flags after this increment
| Flag | Value | Evidence |
|---|---|---|
| download | … | F33 tests; M23 <run/not run> |
| pictureInPicture | … | F21 tests; M19 … |
| clipEditor | … | F34 tests |
| report | … | F35 tests |
| dislike | … | F30 tests |
| qualitySelection | false | expo-video 3.0.11 read-only videoTrack |
| thanks | false | human decision pending (ADR 0009) |

## Performance (ADR 0012)
| Id | Target | Baseline (old) | Measured (new) | Device | Pass |
…

## Open items for the human
- O1 targets, O2 auto-resume, O3 react-native-paper removal, O4 nav bar, O5 now-playing, O6 browsers — <status each>

## Not done / limitations
- <honest list>
```

Commit: `docs: Increment 7 cleanup report and final summary`.

Definition of done for the whole effort: `docs/player/10-migration-and-swap.md` §8. Merge to `main`.
