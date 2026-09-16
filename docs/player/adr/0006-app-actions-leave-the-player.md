# ADR 0006 — App actions leave the player

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 |
| Spec | section 3, section 5.3 |

## Context

The player imports app concerns: `hooks/useVideoActions` (index.tsx:204), `contexts/SavedContext` (`modals/VideoSaveSheet.tsx`), `services/shareLinkService` (`modals/VideoShareSheet.tsx`), and `constants/config.PLAYER_FEATURE_FLAGS` (`VideoActionBar.tsx`, `modals/VideoOverflowMenu.tsx`). Because of this the player cannot render without app providers, cannot be reused by Shorts, and mixes ownership that CLAUDE.md section 5 and the HLD section F.5 assign to app layers. The HLD reference doc (`docs/reference/expo-live-player-architecture-issue.md`, Issue A) already called this out.

## Decision

The action bar, its button primitive, the seven sheets (Save, Share, Download, Clip, Report, Thanks, Overflow) and the `useVideoActions` hook move to `components/Video/actions/`. `VideoPlaybackContainer` renders `<VideoPlayer/>` and then `<VideoActionBar/>` below it, hidden in fullscreen and minimized. The player exposes no action props and has no knowledge of likes, saves, downloads or payments.

Invariant R2: nothing under `components/VideoPlayer/` imports `contexts/`, `services/`, `hooks/` or `app/` at runtime. Type-only imports from `types/domain.ts` (`CaptionItem`, `ChapterItem`) are allowed.

## Alternatives considered

1. **Keep actions in the player behind props.** Rejected: still couples the player's file tree to app UI and doubles the prop surface.
2. **Move actions to the screen (`app/video/[id].tsx`).** Rejected: the screen should stay under 150 lines and the container already owns the domain-to-player mapping.

## Consequences

- Positive: the player renders in isolation; Shorts can adopt the engine later; ownership matches the HLD table.
- Negative: the container gains one child and one test; the sheets' import paths change (mechanical).

## Verification

- Invariant R2 passes.
- `__tests__/player/VideoPlayer.root.test.tsx` renders the player with no providers.
