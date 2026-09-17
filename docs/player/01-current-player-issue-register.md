# 01 — Current Player Issue Register

| Field | Value |
|---|---|
| Date of audit | 2026-09-16 |
| Audited revision | `main` at `10e654b` |
| Audited paths | `components/VideoPlayer/**`, `hooks/useVideoProgress.ts`, `hooks/useVideoActions.ts`, `services/videoActionsService.ts`, `components/Video/VideoPlaybackContainer.tsx` |
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 1.2 |

## How to use this register

- Every issue has an id (`D` for design or code defect, `E` for environment, `Q` for quality-of-life) and a severity: **S1** blocks correctness or leaks resources, **S2** degrades performance or user experience, **S3** violates a project rule without user-visible effect.
- "Resolved by" names the spec section and the increment (see `10-migration-and-swap.md`) that removes the issue. Nothing here is fixed in place; the old files are retired at the swap.
- Line numbers refer to the audited revision. Re-verify with `grep -n` before quoting them elsewhere; the old files are not edited during the build, so they should remain stable.
- When Increment 0 finds new issues, add them here with the next free id and the same columns. Do not delete rows; mark them "Retired at S7" when the old file leaves the tree.

## Summary counts

| Severity | Count |
|---|---|
| S1 | 8 |
| S2 | 9 |
| S3 | 8 |
| Environment | 1 |

## Register

### Architecture and structure

| Id | Sev | Issue | Evidence | Effect | Resolved by | Retired |
|---|---|---|---|---|---|---|
| D1 | S2 | Composition root mixes eight concerns in one 1,111-line file | `components/VideoPlayer/index.tsx` (whole file): expo-video setup, autoplay effect, fullscreen and orientation, web fullscreen, keyboard, gesture heuristics, layout math, five modals, action-bar wiring, diagnostic logging | Every change risks every feature; unreviewable diffs | Spec 3.4: root under 200 lines. Increment 4 | Retired at S7 (98f44e0) |
| D15 | S2 | Duplicate playback state | `index.tsx:178-234` keeps `isPlaying`, `isLoaded`; `usePlayPauseController.ts:71-107` keeps its own `isPlaying`, `isLoaded`; `hooks/useVideoProgress.ts:68-71` keeps `isLoaded` again | Three sources of truth; drift between controls and progress bar | Spec 4: one `PlaybackSnapshot`. Increment 1 | Retired at S7 (98f44e0) |
| D16 | S1 | Player imports app concerns | `index.tsx:55` `useVideoActions`; `index.tsx:204` call; `modals/VideoSaveSheet.tsx:11` `useSaved` from `contexts/SavedContext`; `modals/VideoShareSheet.tsx:15` `shareLinkService`; `VideoActionBar.tsx:23` and `modals/VideoOverflowMenu.tsx:27` `PLAYER_FEATURE_FLAGS` | Player cannot render without app providers (tests must mock `SavedContext`); cannot be reused by Shorts; ownership violates HLD F.5 | ADR 0006, spec 5.3. Increment 5 and 6 | Retired at S7 (98f44e0) |
| D7 | S3 | Near-duplicate button components | `PreviousVideoButton.tsx` (229 lines) vs `NextVideoButton.tsx` (228 lines): a `sed` rename of Previous→Next and chevron-left→chevron-right leaves a 211-line diff of only identifier and comment changes; `MinimizeButton.tsx` repeats the same scale-spring pattern | Two or more places for every button fix | Spec 6.5: one `ControlButton` plus `SkipButton({ direction })`. Increment 3 | Retired at S7 (98f44e0) |
| D8 | S2 | Three animation stacks | RN `Animated`: `PlayPauseButton.tsx:14`, `PreviousVideoButton.tsx:16`, `NextVideoButton.tsx:16`, `MinimizeButton.tsx:17`, `AutoplayNotification.tsx:24-26`, `usePlayPauseController.ts:81`; Reanimated: `VideoActionButton.tsx:23`, `modals/VideoDownloadModal.tsx:23`; `react-native-paper` `IconButton`: `AutoplayToggle.tsx:20`, `FullscreenButton.tsx:13` (paper is used nowhere else in the app) | Inconsistent motion; JS-thread fades; extra bundle | ADR 0003. Increment 3 | Retired at S7 (98f44e0) |
| D19 | S3 | Magic numbers | `index.tsx:92` `QUICK_MS = 10000` (local, not in constants); `:154-156` `3000`, `3500`, `220`; `:260` `400`; `:570` `0.304`; `:678` `9999`; `:305` `1000`; `:407`, `:463` `200`; `:495` `300`; `usePlayPauseController.ts:60-62` defaults `3000`, `3500`, `220` repeated | Violates constants rule; values drift between files | Spec 6.7: `components/VideoPlayer/constants.ts`. Increment 1 | Retired at S7 (98f44e0) |
| D12 | S3 | Web-only code inline and untyped | `index.tsx:373-388` web fullscreen enter with `document.documentElement as any`; `:429-444` exit; `:509-521` keyboard listener; `:522-550` four vendor-prefixed `fullscreenchange` listeners; `:640-646` unmount path | `as any` violates strict TS; untested; runs `Platform.OS === "web"` checks in the component | ADR 0005, spec 7. Increment 2 | Retired at S7 (98f44e0) |
| D13 | S3 | `any` in player code | `index.tsx:77-78` `captions?: any; chapters?: any`; `:95` `(...args: any[])`; `:255-256` `evt.nativeEvent as any`; `:260` `evt.currentTarget as any`; `:328` `(e: any)`; `:914` `wrapperStyle as any`; `usePlayPauseController.ts:66` `(...args: any[])` | Violates CLAUDE.md section 4 | Invariant R6. Increments 1–4 | Retired at S7 (98f44e0) |
| D17 | S2 | Captions and chapters accepted, never rendered | `index.tsx:77-78` declared; no consumer of either prop in the file; `VideoPlaybackContainer.tsx:71-72` passes them | Feature advertised by the type, absent at runtime | F18, F19. Increment 3 | Retired at S7 (98f44e0) |
| D18 | S2 | Minimize button with no mini-player | `MinimizeButton.tsx` exists; `index.tsx:909`, `:946` only hide the bars when `isMinimized`; no minimized layout | Button with no destination | F25. Increment 3 and 4 | Retired at S7 (98f44e0) |

### Playback mechanics

| Id | Sev | Issue | Evidence | Effect | Resolved by | Retired |
|---|---|---|---|---|---|---|
| D2 | S1 | Polling instead of events | `index.tsx:234` `setInterval(checkPlaying, 250)`; `index.tsx:319` `setInterval(checkFinished, 250)`; `usePlayPauseController.ts:106` `setInterval(checkState, 250)`; `hooks/useVideoProgress.ts:122` `setInterval(..., updateInterval)` (250) | 16 wake-ups per second, each with up to 4 `setState` calls; battery; state lag up to 250 ms; expo-video events unused | ADR 0002. Increment 1 | Retired at S7 (98f44e0) |
| D3 | S1 | Buffered range faked | `hooks/useVideoProgress.ts:95-96` "expo-video doesn't have playableDurationMillis, use currentTime as buffered estimate"; `player.bufferedPosition` exists (`VideoPlayer.types.d.ts:141`) | Progress bar's buffered fill is meaningless | Spec 4.1 `bufferedMs`. Increment 1 | Retired at S7 (98f44e0) |
| D4 | S1 | End detection by position comparison | `index.tsx:300` `player.currentTime >= player.duration - 0.1` polled every 250 ms; `setTimeout(onVideoFinished, 1000)` at `:305` fires on each poll while the condition holds | Multiple `onVideoFinished` calls possible; `playToEnd` event unused | Reducer `playToEnd` → `ended`. Increment 1 | Retired at S7 (98f44e0) |
| D5 | S1 | Fullscreen remounts the video in a `Modal` | `index.tsx:896-908` `<Modal visible>` wraps `renderPlayerContent()`; `:360-371` saves position and playing; `:407-424` and `:463-480` restore inside `setTimeout(…, 200)` | Black flash; position jump; race with buffering; the restore can call `play()` on a player that errored | ADR 0004. Increment 2 and 4 | Retired at S7 (98f44e0) |
| D10 | S1 | No error state, buffering indicator, retry or offline handling | `index.tsx:327-333` `onVideoError` only logs and shows controls; no `statusChange` subscription; no UI for `error`; no spinner | User sees a black box on any failure | F7, F8, spec 4.3, 4.4 E4–E6. Increments 1 and 3 | Retired at S7 (98f44e0) |
| D11 | S1 | No background handling, no resume, native player recreated per URL | No `AppState` usage anywhere in `components/VideoPlayer`; `index.tsx:127` `useVideoPlayer(sourceUrl, …)` recreates the native player when the URL changes; no `initialPosition` prop; position lost on fullscreen toggle (D5) | Audio may continue in background on Android; watch position never restored | Spec 4.4 E3, E8; F15. Increment 1 and 4 | Retired at S7 (98f44e0) |
| D14 | S2 | Double-tap zone uses a DOM property on native | `index.tsx:260` `(evt.currentTarget as any)?.clientWidth ?? 400` — `clientWidth` is undefined on native, so the fallback `400` is always used regardless of screen width; `:265` `pageX < 200` fallback | Left/right skip decided by a constant, wrong on most screens | Spec 6.4: zones from `onLayout`. Increment 3 | Retired at S7 (98f44e0) |
| D21 | S2 | Autoplay effect and controller both call `play()` | `index.tsx:161-169` effect calls `player.play()` when `autoplay`; `usePlayPauseController.ts` also handles `autoplay` (line 58 parameter) | Double play call on mount; harmless today but a race once errors are handled | Engine E3 owns autoplay. Increment 1 | Retired at S7 (98f44e0) |
| D22 | S2 | Fullscreen uses `contentFit="fill"` | `index.tsx:768` `resizeMode = isFullscreen ? "fill" : "contain"`; `:784` maps to `contentFit` | Video stretched in fullscreen on non-16:9 content | Spec 6.1: always `contain`. Increment 4 | Retired at S7 (98f44e0) |

### Logging and performance hygiene

| Id | Sev | Issue | Evidence | Effect | Resolved by | Retired |
|---|---|---|---|---|---|---|
| D6 | S2 | Diagnostic logging effects in render path | `index.tsx:574-635` four `Logger.info` calls per dimension change describing past layout tweaks ("white_panel_height_reduced_50_percent", "white_panel_gaps_reduced"); `:654-666` safe-area log; `:740-760` resize-mode log; `:932-945` per-seek logs; `VideoActionBar.tsx:163-170` "applied_bottom_padding" log per render | JSON.stringify of objects on every rotation; console noise; documentation-as-code | Spec 3.4 item 6: one dev-only line per state change. Increment 4 | Retired at S7 (98f44e0) |
| D23 | S3 | Controller logs with `console.warn` in production paths | `usePlayPauseController.ts:130, 143, 155, 179, 229, 248, 260, 281, 308, 343, 356, 364, 390` | Console noise in release builds; try/catch around code that cannot throw | Engine logs through one dev-gated function. Increment 1 | Retired at S7 (98f44e0) |
| D24 | S3 | Redundant `try/catch` wrapping property reads | `usePlayPauseController.ts:97-103`, `index.tsx:225-231`, `hooks/useVideoProgress.ts:80-109` | Hides real errors ("Silent fail" comments) | Engine handles errors through the reducer only. Increment 1 | Retired at S7 (98f44e0) |

### App actions

| Id | Sev | Issue | Evidence | Effect | Resolved by | Retired |
|---|---|---|---|---|---|---|
| D9 | S1 | Action service is an in-memory mock labelled production-ready | `services/videoActionsService.ts:7` "Mock implementation"; `:10` "Production-ready"; `:82` `simulateNetworkDelay`; `:110` `mockVideoState` | Likes, reports, clips lost on restart; fake latency | ADR 0007. Increment 5 | Retired at S7 (98f44e0) |
| D25 | S2 | Download modal fakes progress | `modals/VideoDownloadModal.tsx:70-95` timer-driven progress with "Download completed" log; no `expo-file-system` import | Fake success | ADR 0008. Increment 5 | Retired at S7 (98f44e0) |
| D26 | S2 | Clip editor "saves" to the mock | `modals/VideoClipEditor.tsx:125-134` → `useVideoActions.clip` → mock | Fake success | F34 (metadata-only, labelled). Increment 5 | Retired at S7 (98f44e0) |
| D27 | S3 | Overflow menu items log and close | `modals/VideoOverflowMenu.tsx:176-195` Help, Quality, Captions handlers only log | Dead menu items | Quality display and captions move to the player settings sheet (F18, F24); Help removed. Increment 5 | Retired at S7 (98f44e0) |

### Environment

| Id | Sev | Issue | Evidence | Effect | Resolved by | Retired |
|---|---|---|---|---|---|---|
| E1 | — | Main checkout missing test dependency | `ls node_modules/@testing-library` → not found; `npx tsc --noEmit` reports 31 × `TS2307 Cannot find module '@testing-library/react-native'` in `__tests__` | `npm test` fails in the main checkout; the 375 passing tests were run in `.worktrees/mvp-implementation` | Increment 0 step 1: `npm install` in the main checkout and record the result | Resolved in Increment 0 |

## Issues deliberately not fixed here

| Id | Issue | Reason | Tracked in |
|---|---|---|---|
| Q1 | 18 pre-existing TypeScript errors in `components/Comments/**`, `components/GlobalErrorLogger.ts`, `components/Shorts/ShortsSearchBar.tsx`, `hooks/useVoiceSearch.ts` | Outside the player and outside this effort | HLD section M item 8; `verification-report-2026-09-16.md` |
| Q2 | `hooks/useShortsPlayer.ts` duplicates the engine's lifecycle | Shorts is out of scope (ADR 0011) | `03-architecture.md` "Shorts migration path" |
| Q3 | Two players can be mounted at once (Shorts feed and Video screen in the stack) | App-level concern | Spec S19; later container item |

## Retirement checklist (Increment 7)

When the old files move to `docs/history/videoplayer/2026-09-16-pre-redesign/`, tick each id here as retired and confirm the invariant tests R1–R7 pass. Files to move:

```
components/VideoPlayer/index.tsx            (replaced by two-line re-export)
components/VideoPlayer/AutoplayNotification.tsx
components/VideoPlayer/AutoplayToggle.tsx
components/VideoPlayer/FullscreenButton.tsx
components/VideoPlayer/MinimizeButton.tsx
components/VideoPlayer/NextVideoButton.tsx
components/VideoPlayer/PlayPauseButton.tsx
components/VideoPlayer/PreviousVideoButton.tsx
components/VideoPlayer/usePlayPauseController.ts
components/VideoPlayer/VideoActionBar.tsx        (moved, not retired: becomes components/Video/actions/VideoActionBar.tsx in Increment 5)
components/VideoPlayer/VideoActionButton.tsx     (moved to components/Video/actions/)
components/VideoPlayer/VideoProgressBar.tsx
components/VideoPlayer/VideoTimeOverlay.tsx
components/VideoPlayer/modals/*                  (moved to components/Video/actions/sheets/ in Increment 5)
hooks/useVideoProgress.ts
hooks/useVideoActions.ts                         (moved to components/Video/actions/)
services/videoActionsService.ts
```
