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
