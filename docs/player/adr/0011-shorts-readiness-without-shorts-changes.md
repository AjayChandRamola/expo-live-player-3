# ADR 0011 — Engine designed for Shorts, Shorts migration deferred

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 (human chose option C in brainstorming Question 1) |
| Spec | section 4.6 |

## Context

`components/Shorts/ShortVideoPlayer.tsx` and `hooks/useShortsPlayer.ts` duplicate expo-video lifecycle, polling and error handling. CLAUDE.md says Shorts stays a separate experience unless explicitly approved. The human chose to design the engine so it can serve Shorts, but not to change Shorts in this effort.

## Decision

`EngineOptions` includes `loop`, `mutedByDefault`, `autoplay`, and `initialPositionMs`. `PlaybackCommands` are UI-independent. `PlaybackSnapshot` exposes `positionMs`, `durationMs`, `error`, and `status`, which cover `useShortsPlayer`'s return shape (`isPlaying`, `isLoading`, `error`, `progress`, `duration`, `play`, `pause`, `seek`, `retry`). A "Shorts migration path" section in `docs/player/03-architecture.md` maps each field. `components/Shorts/` and `hooks/useShortsPlayer.ts` are not modified; invariant R7 checks `git diff` against `main` for those paths at every increment.

## Alternatives considered

1. **Out of scope entirely.** Rejected: risks designing an engine that only fits one UI.
2. **Migrate Shorts now.** Rejected: widens the test surface and touches a protected area in the same effort.

## Consequences

- Positive: the later Shorts increment is a consumer change only.
- Negative: duplication between Shorts and the engine persists until that increment.

## Verification

- Invariant R7 passes at every increment.
- `docs/player/03-architecture.md` section "Shorts migration path" exists and maps every `useShortsPlayer` field.
