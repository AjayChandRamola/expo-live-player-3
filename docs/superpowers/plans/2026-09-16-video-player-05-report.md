# Increment 4 (Composition Root) — Report

**Branch:** `feature/player-4-root` (based on `main` after Increment 3 merge)
**Plan:** `docs/superpowers/plans/2026-09-16-video-player-05-root.md`
**Spec:** `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §3.3, §3.4; `docs/player/10-migration-and-swap.md` §3.

## Summary

All 5 tasks complete. `Player.tsx` wires the engine, platform adapters,
gestures and every UI component built in Increments 1–3 into the new
composition root, behind `VideoPlayerProps`, without touching
`components/VideoPlayer/index.tsx` (verified by `OLD_ROOT_FROZEN`).

## Gate

```
npm test          => 87 suites, 752 tests passed
npm run test:web  => 8 suites, 39 tests passed
npm run lint      => 0 errors, warnings only (pre-existing, plus 9 require()/import-order
                     warnings in this increment's own jest.mock hoisting workaround — see below)
npx tsc --noEmit  => 24 errors (same 21 pre-existing + 3 pre-existing-to-Increment-3 baseline;
                     none in this increment's files)
npm test -- --testPathPattern=invariants => 9 passed (R1-R9, OLD_ROOT_FROZEN)
```

## Player.tsx line count (P-budget)

`wc -l components/VideoPlayer/Player.tsx` → **213 lines** (budget 250).

## P4 render-budget measurement

`VideoPlayer.root.perf.test.tsx`: 20 `setSnapshot` calls over a simulated 5
seconds of `timeUpdate` at 250 ms, with controls already auto-hidden,
produced **≤ 20 Profiler `onRender` calls** (budget 20; test asserts
`toBeLessThanOrEqual(20)` and passed without needing additional
`useMemo`/`useCallback` beyond what the plan's own `Player.tsx` code already
applies).

## Deviations from the plan's exact code

1. **`jest.mock` hoisting bug in every root/hook test that mocks the
   platform barrel or `usePlaybackEngine`.** The plan's own example code
   (Tasks 2–5) creates the fake adapters/engine with `const mockAdapters =
   createFakeAdapters()` *before* the `jest.mock(...)` call in the test file.
   Babel's `babel-plugin-jest-hoist` hoists `jest.mock()` calls above all
   other top-level statements, including `const` declarations — but it does
   *not* hoist arbitrary `const`s above `import` statements, and ES imports
   are always evaluated before other top-level code. The result: by the time
   the mocked module is first `require`d (via the `import { useFullscreen }`
   / `import { Player }` line further down), the mock factory runs and reads
   `mockAdapters`/`mockEngine`, which is still `undefined` because the local
   `const` assignment hasn't executed yet. This produced `TypeError: Cannot
   read properties of undefined (reading 'fullscreen')` in every affected
   test file (`useFullscreen.test.tsx`, `rootHooks.test.tsx`,
   `VideoPlayer.root.test.tsx`, `VideoPlayer.parity.test.tsx`,
   `VideoPlayer.root.perf.test.tsx`).

   **Fix (applied consistently in all 5 files):** create the fakes *inside*
   the `jest.mock` factory itself (via `require`, not the hoisted `import`),
   and capture them into an outer `let mockAdapters` / `let mockEngine`
   binding for the test body to read. Since the factory necessarily runs
   before any consumer of the mocked module, the outer binding is always
   populated before it's used. This is a standard, allowed pattern under
   `babel-plugin-jest-hoist`'s "variables prefixed with `mock` may be
   referenced" rule — the fix changes *where* the fake is constructed, not
   whether it's allowed to be referenced. This introduces `require()` calls
   inside `.tsx` test files, which trips
   `@typescript-eslint/no-require-imports` and `import/first` as warnings
   (not errors) — acceptable, matching the mock module's own factory
   constraints (jest.mock factories cannot use hoisted `import`s to
   reference local closures, by construction).

2. **Reentrant `exit()` call in `useFullscreen`.** The plan's exact
   `useFullscreen.ts` code calls `fullscreenAdapter.exit()` and then, in a
   separate effect, subscribes to `fullscreenAdapter.subscribe((active) => {
   if (!active && isFullscreenRef.current) void exit(); })` to mirror
   browser-driven changes (e.g. Escape key). The fake adapter's `exit()`
   fires its own subscribers *synchronously* with `active=false` before
   returning — but at that point `isFullscreenRef.current` is still `true`
   (it's only set to `false` after `exit()`'s `await`s resolve and `apply()`
   runs). The mirroring subscription therefore called `exit()` again
   reentrantly, causing `RangeError: Maximum call stack size exceeded` in
   the "hardware back" and "adapter change (browser Escape)" tests. **Fix:**
   added an `exitingRef` reentrancy guard in `useFullscreen.ts` so a
   recursive `exit()` call while one is already in flight is a no-op.

3. **`useOnStateChange` test's `renderHook` typing.** The plan's exact test
   code passes an untyped destructured callback
   `({ s, cb }) => useOnStateChange(s, cb)` to `renderHook`, which
   `@testing-library/react-native`'s generic inference resolves to
   `(props: unknown) => void`, producing a real (if minor) `tsc` error
   (`Argument of type '({ s, cb }) => void' is not assignable to parameter
   of type '(props: unknown) => void'`). Added an explicit `Props` type
   annotation on the callback parameter to fix it without changing runtime
   behavior.

None of these are behavioral gaps in the shipped code — all three are fixes
to get the plan's own example code (test scaffolding and one real hook bug)
working correctly, verified by the tests the plan itself specifies.

## Not done

None. All 5 tasks from `docs/superpowers/plans/2026-09-16-video-player-05-root.md`
are complete, tested, and gated. Rows C12–C14 and C21 of the parity suite are,
per the plan, deferred to Increment 6's container test and the Increment 1
constants test respectively — not gaps in this increment.
