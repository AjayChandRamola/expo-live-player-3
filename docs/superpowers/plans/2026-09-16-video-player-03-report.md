# Increment 2 — Platform Adapters Report

Date: 2026-09-16  Branch: `feature/player-2-platform` (from `main` @ `a7adefd`, the Increment 1 merge)

## Gate

- `npm test`: **65 suites passed, 637 passed, 2 skipped, 639 total** (Increment 1: 57 suites, 615 passed, 3 skipped)
- `npm run test:web`: **8 suites passed, 39 passed** (up from 1 suite, 2 tests — the 7 new adapter `.web.test.ts` files plus the original smoke test)
- `npm run lint`: **1 error, 396 warnings** — identical to the Increment 1 baseline after one fix (see Deviations)
- `npx tsc --noEmit`: **21 errors**, same count and files as Increment 1; none under `components/VideoPlayer` or `__tests__/player`. The `<name>.ts` suffix-less fallback files resolve correctly — `tsc` never failed to find `"./fullscreen"`-style imports.
- `npx expo-doctor`: same pre-existing 20-package version mismatch as Increment 0/1; no new issues from `app.json`'s `UIBackgroundModes` addition.
- Invariants: **R1, R2, R3, R4, R6, R7, OLD_ROOT_FROZEN passing** (7 passed, 2 skipped — R5 and R9 remain inactive).

## Coverage

All nine tasks: adapter types (3 tests), fullscreen (1 native + 6 web), orientation (4 native + 3 web), system chrome (2 native + 1 web), keyboard (2 native + 20 web), picture-in-picture (4 native + 4 web), brightness (4 native + 2 web), haptics (1 native + 1 web), plus the barrel and fake adapters (no new tests — consumed starting Increment 3/4). Total new tests: 22 native-project tests (637 − 615 = 22) and 37 web-project tests (39 − 2 = 37).

Every adapter has both a `.native.ts` and a `.web.ts` implementation behind the same interface, plus a suffix-less `.ts` fallback for `tsc`, exactly matching the plan's file structure.

## Deviations

1. **One new lint warning, fixed.** `orientation.web.test.ts`'s `listeners: Array<(e: { matches: boolean }) => void> = []` (as written in the plan) triggers this project's `@typescript-eslint/array-type` rule, which requires `T[]` over `Array<T>`. Changed to `((e: { matches: boolean }) => void)[]`. No behavioural change; `npm run lint` is back to the Increment 1 baseline of 396 warnings, and the affected test still passes.
2. Nothing else deviated. Every other test in every task passed on the first implementation, matching the plan's expected counts exactly (1/6, 4/3, 2/1, 2/20, 4/4, 4/2, 1/1).

## Platform notes

- **PiP support gates:** iOS ≥ 14, Android API ≥ 26 (version-number check only; runtime verification is manual matrix row M19, deferred — no physical device in this session, consistent with Increment 0's finding).
- **`app.json`:** `ios.infoPlist.UIBackgroundModes = ["audio"]` added for PiP continuity. Configuration only — no native code, no prebuild, `npx expo-doctor` unaffected.
- **Module resolution:** `tsc` resolves the suffix-less `<name>.ts` fallback files (each a one-line `export * from "./<name>.native"`); Metro and Jest pick `.native.ts`/`.web.ts` first via their own platform resolution. Both paths verified: the native Jest project imports `.native.ts` files directly in tests, and `jest.web.config.js` (`jest-expo/web` preset) resolves `.web.ts` files for the second project.
- **Jest web preset used:** `jest-expo/web` (the primary path from Increment 0's Task 3, not the `haste.defaultPlatform` fallback) — still working without modification for all seven new adapters' web test files.
- **R4 activation confirms the design's own claim:** only `pictureInPicture.native.ts` reads `Platform.OS`/`Platform.Version` among the new platform files, and it is inside `platform/`, so R4 (no `Platform.OS` outside `platform/`) passes with zero offenders on the first run.

## Not done

- Android immersive navigation bar (open item O4) — not implemented by design, per the plan.
- PiP runtime behaviour (M19), and all device-dependent verification generally, remains unmeasured — no physical device in this session, same limitation recorded in Increments 0 and 1.
