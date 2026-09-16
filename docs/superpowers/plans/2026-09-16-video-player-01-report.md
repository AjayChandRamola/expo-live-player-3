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
