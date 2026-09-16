# ADR 0002 — Event-driven playback engine with a pure reducer

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 |
| Spec | section 4 |

## Context

The current player derives playback state by polling `player.playing` and `player.duration` every 250 ms in three separate places (`index.tsx:234`, `index.tsx:319`, `usePlayPauseController.ts:106`, `hooks/useVideoProgress.ts:122`). It fakes the buffered range as the current position, detects end-of-video by comparing position to duration, and keeps three copies of `isPlaying`. expo-video 3.0.11 emits `statusChange`, `playingChange`, `timeUpdate`, `playToEnd`, `sourceChange`, `playbackRateChange`, `mutedChange`, `volumeChange`, `videoTrackChange`, `availableSubtitleTracksChange`, `subtitleTrackChange` (verified in `node_modules/expo-video/build/VideoPlayerEvents.types.d.ts`) and exposes `bufferedPosition`, `isLive`, `currentOffsetFromLive`.

## Decision

One `PlaybackEngine` class subscribes to expo-video events and feeds them, together with derived events (stall, retry scheduled, app background/foreground) and command results, into a pure function `playbackReducer(prev, event) → next` that owns every status transition. The engine publishes an immutable `PlaybackSnapshot` only when the reducer returns a new object. React consumes it through `useSyncExternalStore` in `usePlaybackEngine`.

The only timers the player owns are the stall detector (2 s without `timeUpdate` while playing), the retry delay, and the load timeout. There is no periodic polling.

## Alternatives considered

1. **Keep polling but centralise it in one hook.** Rejected: still 4 wake-ups per second, still an estimate for buffered range, still position-based end detection.
2. **Use React state and effects directly on the expo-video object without a reducer.** Rejected: transitions scattered across effects cannot be exhaustively tested; the reducer table makes every (state, event) pair a test case runnable without React Native.
3. **Adopt a state-machine library (XState).** Rejected: new dependency; a plain reducer with a table is enough and easier for a less capable implementer to follow.

## Consequences

- Positive: state is testable in plain Jest; one source of truth; fewer renders (P4 target); accurate buffered range; correct `ended`.
- Negative: implementers must add a reducer row and a test for any new event. The transition table in the spec is the contract.

## Verification

- Every cell of the transition table in spec section 4.2 has a test in `__tests__/player/engine/playbackReducer.test.ts`.
- `grep -rn "setInterval" components/VideoPlayer` returns nothing after the swap.
