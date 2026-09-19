# Rollback Plan

Principle: one logical change per commit on `main`; rollback is `git revert <sha>` followed by the dependency or build refresh listed below. Never `git reset --hard`, never force-push, never rewrite history. Rollbacks are recorded in the decision log with the reason and the evidence that triggered them.

| Change | Rollback command(s) | Post-rollback refresh | Verification after rollback |
|---|---|---|---|
| C-01 harness fix | `git revert <sha>` | none | `npm test` returns to 80/95 (expected) — only roll back if the fix itself caused a regression; prefer fixing forward |
| C-02 measurement tooling | `git revert <sha>` | none | scripts absent; `.gitignore` restored |
| C-03 identifiers / eas.json | `git revert <sha>` | delete generated `android/` (`npx expo prebuild --clean` regenerates) | `npx expo config` shows no identifiers. Do not roll back after a store upload |
| C-04 native package removal | `git revert <sha>`; `npm ci` | `npx expo-modules-autolinking resolve -p android --json` shows 23 again | `npm test`, export |
| C-05 JS package removal | `git revert <sha>`; `npm ci` | — | export byte-identical to pre-rollback (they were unused) |
| C-06 dev tooling move | `git revert <sha>`; `npm ci` | — | `npm run lint`, `npx tsc --noEmit` counts as before |
| C-07 dead files | `git revert <sha>` | — | `tsc` count returns to 29 |
| C-08 deep icon imports (two commits) | `git revert <shorts-sha>`; `git revert <non-shorts-sha>` | — | export lists 19 vector-icon TTFs again; lint rule gone |
| C-08b MaterialIcons retirement | `git revert <sha>` | — | Android tab glyphs restored |
| C-09 SVG removal | `git revert <sha>`; `npm ci` | — | `react-native-svg` autolinked again; SVG tab icons; svg mock restored; `npm test` |
| C-10 blurhash placeholder | `git revert <sha>` | — | PNG placeholder back in export |
| C-11 console stripping | `git revert <sha>`; `npm ci` | — | production export contains `console.log` again; `Logger.test.ts` back to previous expectations |
| C-14 build properties | `git revert <sha>`; `npm ci`; `npx expo prebuild -p android --clean` | rebuild AAB | `gradle.properties` shows shrinking off; playback rows pass |
| C-17 docs | `git revert <sha>` | — | — |
| C-19 guards and docs | `git revert <sha>` | — | lint runs without the extra rules |
| X-1 / X-3 experiments | never merged unless accepted; if accepted and later reverted: `git revert`; `npm ci`; prebuild | rebuild | full matrix |

## Partial rollback inside a change

- C-08: if one file's icon rendering regresses, revert only that file's import line; the lint rule can be disabled for that file with a justified `eslint-disable-next-line no-restricted-imports` comment while the cause is investigated (the fonts will be bundled again until resolved).
- C-14: if only HLS fails, do not turn R8 off; add the narrowest keep rule (`extraProguardRules`) and rebuild. Turn R8 off only if no keep rule fixes the reproduced failure within the phase.
- C-11: if a specific `console.info` is needed in production, convert that call to `console.warn` or `Logger.warn` with justification rather than disabling the plugin.

## Rollback decision rule

Roll back a change when, after it, any of these is true and cannot be fixed forward within the same phase: a regression-matrix "Must preserve" row fails; the size report is larger than before the change; a performance protocol metric regresses beyond noise; a quality gate count increases. Record the decision as `DL-nn` with the failing evidence.
