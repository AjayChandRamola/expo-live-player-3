# ADR 0001 — Parallel rebuild behind VideoPlaybackContainer, then swap

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 |
| Deciders | Product owner (human), Fable 5.1 (design) |
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 2, section 10 |

## Context

`components/VideoPlayer/index.tsx` is 1,111 lines and mixes playback, fullscreen, gestures, layout, five modals, action wiring and diagnostic logging. Its core is polling-based (three 250 ms intervals) and its fullscreen path remounts the video inside a `Modal`. The human has stated the player has design, functional and performance issues to be fixed, and wants a lean, fast, robust player for Android, iOS and web.

Exactly one production module imports the player: `components/Video/VideoPlaybackContainer.tsx`. CLAUDE.md section 6 forbids creating a second generic player without explicit approval, which this ADR records.

## Decision

Build the new player in new subfolders of `components/VideoPlayer/` (`engine/`, `platform/`, `gestures/`, `ui/`) and a new composition root `Player.tsx`, while the existing flat files remain live and untouched. When the parity checklist passes, make `index.tsx` re-export `Player.tsx`, update the container to the new typed props, and move the old files to `docs/history/videoplayer/2026-09-16-pre-redesign/`.

During the build, the app never imports the new code. Only `index.tsx` is imported by the container, and `index.tsx` is unchanged until the swap.

## Alternatives considered

1. **Refactor in place (strangler).** Extract one concern at a time and re-wire the 1,111-line file after each step. Rejected: the polling core and `Modal` fullscreen must be replaced, not moved, so each intermediate state is a hybrid that is hard to reason about and hard for a less capable implementer to keep correct. The large file stays the centre of gravity for most of the work.
2. **Rebuild the engine, migrate the existing UI controls.** Rejected: the controls hold most of the duplication (Previous/Next near-copies) and all three animation stacks, so the saving is small and the result carries old problems into the new structure.

## Consequences

- Positive: each task is "build this unit to this interface with these tests"; the swap is one commit with a one-commit rollback; the old code is never half-modified.
- Negative: two player implementations coexist in the tree for several increments. Mitigation: invariant test R1 (only the container imports the player) and the rule that `index.tsx` is not touched before the swap.
- The temporary name `Player.tsx` becomes the permanent composition root file; `index.tsx` stays a two-line re-export after the swap so the public import path never changes.

## Verification

- `__tests__/player/invariants.test.ts` R1 passes at every increment.
- `git diff main -- components/VideoPlayer/index.tsx` is empty until the swap commit.
