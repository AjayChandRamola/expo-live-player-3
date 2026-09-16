# Increment 0 — Baseline Report

Date: 2026-09-16
Branch: feature/player-0-baseline
Base: main @ b1a0d7e (docs merge)

## Task 1 — Toolchain

- `npm install`: completed without `--legacy-peer-deps`. Added 175 packages,
  removed 3, changed 15. npm reported 45 vulnerabilities (1 low, 18 moderate,
  24 high, 2 critical) in the existing dependency tree; none introduced by this
  increment, none triaged here.
- `ls node_modules/@testing-library/react-native/package.json`: present.

### Deviation: `jest.testPathIgnorePatterns`

The plan limited `package.json` changes to the `test:web` script, the
`setupFilesAfterEnv` entry, and `expo-brightness`. One more change was
required before the quality gate could run at all.

`git worktree list` shows a second worktree at `.worktrees/mvp-implementation`.
Jest's `testMatch` (`**/__tests__/**/*.test.[jt]s?(x)`) walks into it, so the
first `npm test` run collected 84 suites — every suite twice. The 28 worktree
copies all failed, because that worktree has no `node_modules` of its own:

```
Test Suites: 28 failed, 56 passed, 84 total
Tests:       23 failed, 503 passed, 526 total
```

Every failure path began with `.worktrees/mvp-implementation/`. No suite in the
main checkout failed.

Fix applied to `package.json`:

```json
"testPathIgnorePatterns": [
  "/node_modules/",
  "/.worktrees/"
],
```

This is test configuration only and touches no file under `components/`,
`hooks/`, `services/`, `contexts/`, or `app/`, so it respects the spirit of the
increment's constraint.

### Quality gate after the fix

- `npm test`: **42 suites passed, 42 total; 375 tests passed, 375 total**, in
  97s. This matches the counts recorded in `verification-report-2026-09-16.md`
  exactly, confirming the toolchain restore changed no behaviour.
- Jest printed `A worker process has failed to exit gracefully and has been
  force exited.` The run still passes. This points at a timer or listener left
  active by a test — consistent with the cleanup issues the redesign targets
  (`docs/player/08-reliability-and-performance.md`). Tracked, not fixed here.

- `npx tsc --noEmit`: **21 errors**, below the plan's ≤24 expectation. All 31
  `TS2307` errors for the missing test library are gone, as predicted. The
  remaining 21 are pre-existing and all outside the player redesign scope.

Per file:

```
7  components/Comments/CommentsModal.tsx
5  components/Comments/Home/HomeVideoCommentsModal.tsx
2  components/Comments/CommentComposer.tsx
2  app/
1  hooks/useVoiceSearch.ts
1  components/Shorts/ShortsSearchBar.tsx
1  components/GlobalErrorLogger.ts
1  components/Comments/CommentItem.tsx
1  app/_layout.tsx
```

By error code:

```
6  TS2304  cannot find name
4  TS2339  property does not exist
3  TS2769  no overload matches
3  TS2345  argument not assignable
1  TS7006  implicit any parameter
1  TS2614  no exported member
1  TS2353  unknown object literal property
1  TS2322  type not assignable
1  TS2307  cannot find module
```

Note the plan's "Verified Starting State" predicted 24 route-typing errors would
remain including 6 in tests; the actual figure is 21 with none in `__tests__`.
The baseline for later increments is therefore **21**, and no increment may
raise it.

## Task 2 — Shared Jest setup and native-module mocks

- Created `__tests__/harness/setup.ts` mocking `expo-screen-orientation`,
  `expo-brightness`, `expo-haptics`, and `react-native-reanimated`, and wired it
  into `jest.setupFilesAfterEnv` after the RNTL matchers.
- Created `__tests__/harness/setup.test.ts`, which asserts each mock is present
  and returns the documented shape. Run before the setup file existed it failed
  with `Cannot find module 'expo-brightness'`, as the plan predicted.
- `npx expo install expo-brightness` installed **`~14.0.8`** per ADR 0010.
  Nothing imports it yet; Increment 3 (platform adapters) will.

### Verification

- `npm test -- --testPathPattern=harness/setup`: 3 passed.
- `npm test`: **43 suites passed, 378 tests passed** — the 42/375 baseline plus
  this one new suite of three tests. No existing suite regressed, so the
  Reanimated mock stays in `setup.ts` and no per-file fallback was needed.
  `VideoPlayer.render.test.tsx` keeps its own file-level
  `jest.mock("expo-screen-orientation")`, which overrides the setup mock without
  conflict, exactly as the plan anticipated.

### `npx expo-doctor`

Not clean, but not clean before this increment either:

```
✖ Check that packages match versions required by installed Expo SDK
1 check failed, indicating possible issues with the project.
```

The check names 20 packages whose installed versions differ from the SDK 54
recommendations (`expo-asset`, `expo-audio`, `expo-constants`,
`expo-file-system`, `expo-font`, `expo-haptics`, `expo-image`,
`expo-keep-awake`, `expo-linear-gradient`, `expo-linking`, `expo-router`,
`expo-screen-orientation`, `expo-splash-screen`, `expo-status-bar`,
`expo-symbols`, `expo-system-ui`, `expo-video`, `expo-web-browser`, and two
others). **`expo-brightness` is not among them** — `npx expo install` picked the
SDK-correct version. This increment therefore neither introduced nor resolved
the failure. Aligning those 20 packages is out of scope here and should be its
own change, since `expo-video` and `expo-screen-orientation` are on the list and
moving them would disturb the very playback behaviour the next tasks are about
to characterize.

## Task 3 — Web Jest project

- Created `jest.web.config.js`, `__tests__/harness/setup.web.ts`, and
  `__tests__/player/platform/smoke.web.test.ts`; added `"test:web": "jest -c
  jest.web.config.js"` to `package.json` scripts.
- Run before the config existed, `npm run test:web` failed with a config-not-found
  error, as the plan predicted.
- Neither fallback in the plan's Step 4 was needed: the `jest-expo/web` preset
  resolved, and `jest-environment-jsdom` was already present, so **no extra dev
  dependency was added**.

### Step 5 — default project had to be taught to skip web tests

The plan flagged this as a possibility and it happened. The default project's
`testMatch` (`**/__tests__/**/*.test.[jt]s?(x)`) matched `smoke.web.test.ts`,
ran it under the native preset, and failed both assertions because `Platform.OS`
resolved to `"ios"`. Applied the plan's prescribed fix, merged into the
`testPathIgnorePatterns` array introduced in Task 1:

```json
"testPathIgnorePatterns": [
  "/node_modules/",
  "/.worktrees/",
  "\.web\.test\.tsx?$"
],
```

### Verification

- `npm run test:web`: **2 passed** (`PASS Web`, confirming the web platform
  resolution is active).
- `npm test -- --testPathPattern=smoke.web`: 0 matches — the default project no
  longer sees web tests.
- `npm test`: **43 suites passed, 378 tests passed** — unchanged, so adding the
  web project cost the native suite nothing.

## Task 4 — Architecture invariant tests

Created `__tests__/player/invariants.test.ts`, which reads the source tree and
enforces the dependency rules from `docs/player/03-architecture.md` §2. Rules are
gated by an `ACTIVE_RULES` array so later increments activate them rather than
add new files.

```
Tests: 5 skipped, 4 passed, 9 total

√ R1: only VideoPlaybackContainer imports components/VideoPlayer
√ R2: player imports no app contexts/services/hooks/app at runtime
√ R7: Shorts and useShortsPlayer are unchanged from main
√ old components/VideoPlayer/index.tsx is byte-identical to main
○ R3 R4 R5 R6 R9  (inactive until components/VideoPlayer/{engine,platform,gestures,ui,hooks} exist)
```

**R1 passing on the first run is a useful finding**: `VideoPlaybackContainer` is
already the only importer of the player outside the player's own folder, so the
Increment 6 swap has exactly one call site to change, as the migration doc
assumed.

### Second deviation: `jest.modulePathIgnorePatterns`

This run surfaced a warning that predates the increment:

```
jest-haste-map: duplicate manual mock found: svgMock
    * <rootDir>\__mocks__\svgMock.js
    * <rootDir>\.worktrees\mvp-implementation\__mocks__\svgMock.js
```

`testPathIgnorePatterns` stops Jest *running* worktree tests but does not stop
haste-map *scanning* the worktree, so the manual mock was ambiguous on every
run. Added, alongside the Task 1 change:

```json
"modulePathIgnorePatterns": [
  "/\.worktrees/"
],
```

The warning is gone and the full suite is unaffected. Same justification as the
first deviation: test configuration only.

### Verification

- `npm test -- --testPathPattern=invariants`: 4 passed, 5 skipped.
- `npm test`: **44 suites passed, 382 passed, 5 skipped, 387 total.**

## Task 5 — Parity characterization of the old player

Appended a `VideoPlayer parity characterization (old player)` block to
`__tests__/player/VideoPlayer.render.test.tsx`, covering migration rows C3, C4,
C5/C6, C7, C9, C10/C11, and C14. The file's existing mocks and four tests are
untouched.

**All nine new rows passed on the first run.** No label regex needed adjusting
and neither of the plan's contingencies (a `StatusBar.setHidden` spy for C9, a
weakened row) was required.

### Parity labels (old player)

These are the accessibility labels the new player must keep, read from source
rather than guessed. Increment 4's parity suite matches against them; any change
needs an explicit "intentional change" note.

| Row | Component | Label |
|-----|-----------|-------|
| C5 | `NextVideoButton.tsx` | `Next video` / `Next video (unavailable)` |
| C6 | `PreviousVideoButton.tsx` | `Previous video` / `Previous video (unavailable)` |
| C7 | `MinimizeButton.tsx` | `Minimize video to picture-in-picture (downward caret)` / `Restore video to full screen (upward caret)`, suffixed `(unavailable)` when disabled |
| C9 | `FullscreenButton.tsx` | `Enter fullscreen` / `Exit fullscreen` |
| — | `PlayPauseButton.tsx` | `Play video` / `Pause video` |
| C10 | `VideoProgressBar.tsx` | `Video progress bar. Current time: <t>`; handle `Scrubber handle. Drag to seek through video` |
| C11 | `VideoActionBar.tsx` | `Like button. …`, `Share button. …`, `Save button. …`, `More options button. …` |
| C14 | `VideoActionBar.tsx` | flag-hidden: `Dislike button. …`, `Download button. …`, `Clip button. …` |

### Confirmed behaviours

- **C3**: exactly one `VideoView`, with `nativeControls={false}` and
  `allowsFullscreen={false}` — the player owns its chrome.
- **C4**: `play()` is called on mount by default and not called with
  `autoplay={false}`.
- **C5/C6**: handlers fire when a neighbour exists and are suppressed by
  `disabled` when it does not.
- **C9**: `onFullscreenChange(false)` fires on mount, then `(true)` after press.
- **C10/C11**: with no `videoId`, neither progress bar nor action bar mounts.

### Observation for later increments: leaked timers in the old player

The run emits many `Cannot log after tests are done` warnings, all traced to
`components/VideoPlayer/usePlayPauseController.ts:67` reached from timeouts at
lines 206 and 241. The controller leaves timers running after unmount, and they
fire after the test completes. This is the same root cause as the
`A worker process has failed to exit gracefully` message seen in Task 1, and it
is a concrete instance of the cleanup failures in CLAUDE.md §7 and
`docs/player/08-reliability-and-performance.md`. Not fixed here — this increment
changes no production code — but the new engine must clear its timers on
teardown, and Increment 1 should assert it.

### Verification

- `npm test -- --testPathPattern=VideoPlayer.render`: **13 passed** (4 existing
  + 9 new).
- `npm test`: **44 suites passed, 391 passed, 5 skipped, 396 total.**

## Task 6 — Bundle-size baseline (P8)

Recorded in `docs/player/baselines/2026-09-16-current-player.md`.

**Player code is 80,950 B of 290,259 B of first-party bundle bytes — 27.89 %**
(2.15 % of the whole 3.76 MB Android bundle), across 21 source files.
`components/VideoPlayer/index.tsx` alone is 13,498 B, 17 % of the player.

The share of *first-party* code is the figure Increment 7 must compare against.
The whole-bundle percentage is dominated by React Native and Expo and would hide
any change the redesign makes.

Two method substitutions were required, both documented in the baseline file and
both mandatory for Increment 7 to reuse:

1. `expo export` emits Hermes bytecode (`.hbc`) by default, which
   `source-map-explorer` cannot read and which does not map cleanly to source
   files. Added `--no-bytecode`.
2. `source-map-explorer` failed twice — first chasing the bundle's
   `sourceMappingURL` to `http://localhost:8081/…`, then, with the map passed
   explicitly, with *"source map refers to generated column Infinity on line 2,
   but the source only contains 2417 columns."* Replaced with
   `scripts/measure-player-bundle.js` (committed), which decodes the VLQ
   mappings and charges each generated byte range to its source.

`.baseline-export/` was deleted after measuring; `git status` is clean.

## Task 7 — Device baselines (P1, P2, P4, P5, P9)

**Skipped: no physical device attached in this session.** Per the plan's own
Step 1 this is the correct outcome, and no numbers were estimated. The rows stay
as "not measured" in the baseline file with the reason recorded. They need the
procedure in `docs/player/08-reliability-and-performance.md` §2.

This is the main limitation of Increment 0: the redesign's startup, render-rate,
memory and battery goals currently have **no measured starting point**. Until a
device run happens, no later increment may claim an improvement on P1, P2, P4,
P5, or P9.

## Gate

| Check | Result |
|---|---|
| `npm test` | **44 suites passed, 391 passed, 5 skipped, 396 total** |
| `npm run test:web` | **1 suite, 2 passed** |
| `npm run lint` | **1 error, 396 warnings** — matches the recorded baseline exactly |
| `npx tsc --noEmit` | **21 errors**, all pre-existing (Comments/*, GlobalErrorLogger, ShortsSearchBar, useVoiceSearch, app routes) |
| `npx expo-doctor` | 1 pre-existing check failure (20 SDK version mismatches); `expo-brightness` not implicated |

The single lint error is `hooks/useVoiceSearch.ts:16 Unable to resolve path to
module 'expo-speech'` — pre-existing, and the same cause as the one remaining
`TS2307`. The new files added by this increment produce **no lint output at
all**.

### Third deviation: `eslint.config.js` ignores

The first gate run reported `2 errors, 792 warnings` — exactly double the
recorded baseline, because ESLint was walking `.worktrees/` (68 of the reported
paths were inside it). Same class of problem as the Jest deviations. Fixed:

```js
ignores: ['dist/*', '.worktrees/**', '.baseline-export/**'],
```

After the fix the count is `1 error, 396 warnings`, matching the baseline in the
plan.

## Summary of deviations

All four are test/lint configuration only. No file under `components/`,
`hooks/`, `services/`, `contexts/`, or `app/` was modified in this increment,
and the only production dependency added is `expo-brightness`, which nothing
imports yet.

| # | Change | Why |
|---|---|---|
| 1 | `jest.testPathIgnorePatterns` += `/.worktrees/` | Jest ran every suite twice; 28 duplicates failed for want of `node_modules` |
| 2 | `jest.testPathIgnorePatterns` += `\.web\.test\.tsx?$` | Default native project ran the web smoke test and failed on `Platform.OS` |
| 3 | `jest.modulePathIgnorePatterns` += `/\.worktrees/` | haste-map found a duplicate `svgMock` manual mock |
| 4 | `eslint.config.js` ignores `.worktrees/**`, `.baseline-export/**` | ESLint double-counted every problem |

The root cause of three of the four is the same: the `.worktrees/` directory is
invisible to every tool's default configuration but visible to its file walker.

## Not done / limitations

- **Device baselines P1, P2, P4, P5, P9 are not measured.** No device. This is
  the one gap that blocks evidence-based performance claims later.
- **`npx expo-doctor` is not clean**, and was not clean before this increment.
  20 Expo packages differ from the SDK 54 recommendations, including
  `expo-video` and `expo-screen-orientation`. Deliberately not touched: moving
  them would disturb the playback behaviour Task 5 just characterized. Worth its
  own change before the Increment 6 swap.
- **`npm install` reported 45 vulnerabilities** (2 critical, 24 high) in the
  existing dependency tree. Not introduced here, not triaged here, and out of
  this increment's scope — but it should be triaged, since CLAUDE.md §9 requires
  reviewing dependency vulnerabilities.
- **The old player leaks timers.** `usePlayPauseController.ts` logs after
  teardown and Jest force-exits a worker. Recorded under Task 5; the new engine
  must clear timers on unmount and Increment 1 should assert it.
- **Parity rows beyond C3–C14 are not covered.** Rows requiring gesture,
  orientation, or network simulation are left to the increments that build those
  subsystems, as the plan intends.

## Status

Increment 0 is complete. Seven commits on `feature/player-0-baseline`. The tree
is green, the invariants are armed, the old player's behaviour is locked, and
the P8 baseline is recorded. Increment 1 (engine) can start.
