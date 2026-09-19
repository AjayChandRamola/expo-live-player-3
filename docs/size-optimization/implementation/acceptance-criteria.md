# Acceptance Criteria

## Overall

1. No user-facing feature listed in `regression-matrix.md` is removed or degraded; every "Must preserve" row passes on the final emulator release build.
2. Every size claim in the final report is backed by a command and a number in `optimization/size-baseline.md` (before) and its "after" column; anything not measured is written as NOT MEASURED.
3. All changes are on `main`, one logical change per commit, each revertible with `git revert`.
4. Quality gates at completion: `npm test` 95/95 suites; `npx tsc --noEmit` runtime-source errors ≤ 24 (baseline 29 minus the 5 removed by C-07); `npm run lint` errors ≤ 78 and zero new `no-restricted-imports` violations; `npm run size:check` passes against the tightened `size-budget.json`.
5. Documentation updated: baseline "after" table, decision log statuses, project structure reference, `CLAUDE.md` stack line (with approval), and this package's README status line.

## Per phase

| Phase | Criteria |
|---|---|
| 0 Baseline | C-01: `npm test` reports 95 passed / 95 total. C-02: `npm run size:report` reproduces the baseline numbers (bundle bytes, asset bytes and counts, TTF list) exactly; unit test for the script passes; `.baseline-export/` ignored. C-03: identifiers set (D-1); `eas.json` present; `npx expo-doctor` clean. C-03b: AAB, per-ABI download, universal APK, `lib/` and `dex` bytes, and permission list recorded in `size-baseline.md` §6. |
| 1 Dependencies | C-04: `package.json` no longer lists the four native packages; autolinking shows 20 Expo (Android) / 22 (iOS) and 10 RN modules; export succeeds; all gates. C-05: seven JS packages gone; export byte-identical bundle (assets and HBC bytes unchanged) — proves they were unused. C-06: each tool once under devDependencies; `npm ls typescript` one version; lint output unchanged. C-07: five files and three PNGs deleted; `expo-speech` line removed; runtime tsc errors 24. `dependencyGuards.test.ts` passes. |
| 2 Assets | C-08: export log lists exactly `MaterialCommunityIcons.ttf` and `MaterialIcons.ttf` from `@expo/vector-icons`; Android asset count 30, bytes ≤ 2,658,869; iOS 26 / ≤ 1,692,711; lint fixture test fails on a barrel import; invariants suite passes after the Shorts commit. C-09 (if D-4 approved): `react-native-svg` absent from `package.json`, attribution, and autolinking; tab icon screenshots approved at 1×/2×/3×; tab layout test updated and green; `metro.config.js` is the default config. C-10 (if D-5): placeholder PNG absent from export; feed renders placeholder. |
| 3 JavaScript | C-11: production `--no-bytecode` export contains zero `console.log(`/`console.info(`/`console.debug(` call sites and still contains `console.error(`; development transform keeps all; `Logger.test.ts` green with `__DEV__` gating; HBC bytes ≤ previous. |
| 4 Expo config | C-12: `build-architecture.md` §1 defaults confirmed from `npx expo config --type introspect`; no autolinking exclusions added. |
| 5 Android | C-14: prebuilt `android/` shows R8 and resource shrinking enabled; AAB builds; `mapping.txt` retained; regression rows 8, 9, 11, 15 pass on the release build; four Android numbers recorded before and after; if a keep rule was needed, it is the narrowest that fixes the reproduced failure and is logged. |
| 6 Video | C-16: invariants R1–R9 green; engine properties unchanged (grep); playback rows pass. — verified 2026-09-19: `invariants.test.ts` 10/10 passed; `keepScreenOnWhilePlaying = true` and `staysActiveInBackground = false` confirmed at `PlaybackEngine.ts:176-177`; `git diff --stat b3fb438 HEAD -- components/VideoPlayer/engine components/VideoPlayer/platform components/VideoPlayer/Player.tsx components/VideoPlayer/ui/PlayerSurface.tsx` produced no output (zero diffs across the entire initiative). MP4 playback also confirmed on a real R8-shrunk release build (Task 16): position advanced 0:00→0:16, no crash. |
| 7 Production build | C-17: build instructions in `build-architecture.md` §4 reflect the chosen path; README section added. |
| 8 Regression | C-18: every matrix row executed on the final build with result recorded (pass/fail/not-run with reason). |
| 9 Verification | Final `size:report` for both platforms; Android four numbers; performance protocol rows that are emulator-measurable executed and recorded; device rows marked deferred. |
| 10 Hardening | C-19: lint guards in place; `size-budget.json` tightened to achieved values; `size:check` passes; docs updated; decision log statuses set. |

## Definition of done for the initiative

All per-phase criteria met, or the phase explicitly marked "not executed" with the human's decision recorded (for example if D-4 rejects C-09). The implementation readiness review's "must not change" list is verified unchanged by `git diff --stat b3fb438 -- components/VideoPlayer/engine components/VideoPlayer/platform components/VideoPlayer/Player.tsx` showing no changes.
