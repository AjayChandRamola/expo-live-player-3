6. Important architecture issues found

These are the findings that should influence the new mobile app design.

Issue A — Player actions and application actions are mixed

The existing player has UI actions such as Like, Save, Share, Download, and Thanks.

Some are player-local behaviors, while others should be application/domain operations.

For example:

Play / Pause
    → Player responsibility

Seek
    → Player responsibility

Save video
    → Application / persistence responsibility

Like video
    → Application / backend responsibility

Thanks / donation
    → Future application service responsibility

Recommendation: Keep the existing UI working, but establish a clean ownership boundary in the new HLD.

Resolved by the 2026-09-16 redesign: see ADR 0006 / PlayQueueContext / ADR 0011 / docs/player/03-architecture.md.

Issue B — VideoPlayerContext is not a complete content repository

The context manages:

video list

current video

current index

next/previous

autoplay

home scroll position

It is useful for player navigation, but it should not become the entire application's data layer.

The new HLD should separate:

Video catalog / content state
        │
        ▼
Player navigation state
        │
        ▼
Actual playback state

Resolved by the 2026-09-16 redesign: see ADR 0006 / PlayQueueContext / ADR 0011 / docs/player/03-architecture.md.

Issue C — Local catalog and external URL are demo behavior

The current video screen contains a local catalog with sample videos, including an HLS stream and an MP4 stream.

The new app must distinguish:

Demo content
    vs
Production content

Do not make local sample catalog behavior the permanent architecture.

Issue D — Shorts has a separate player

The project contains:

components/Shorts/ShortVideoPlayer.tsx

Fable must decide whether this should remain separate from the main VideoPlayer or whether a future shared playback abstraction is appropriate.

For MVP, do not rewrite it automatically.

Resolved by the 2026-09-16 redesign: see ADR 0006 / PlayQueueContext / ADR 0011 / docs/player/03-architecture.md. Shorts remained separate (R7).

Issue E — Player is already large

The current VideoPlayer is composed of many files, controls, modals, hooks, and utilities.

This means our earlier goal of “compact code” should be refined:

We want a maintainable player, not necessarily a single small file.

The right target is clear responsibilities and minimal duplication.

Resolved by the 2026-09-16 redesign: see ADR 0006 / PlayQueueContext / ADR 0011 / docs/player/03-architecture.md.

7. Updated architecture flow

Based on the actual player, I recommend this development flow.

New division of responsibility

Model

	

What it should know




Fable

	

Product vision, existing requirements, VideoPlayer Reference Brief, technology constraints




Opus

	

All of the above + approved HLD + actual player source when implementing/refactoring player boundaries




GLM 5.3

	

Approved LLD + exact implementation tasks + relevant source files




You

	

Approve scope, UX, architecture, and working increments

The reference brief is intended to save Fable from scanning the entire player source. However, Opus should still inspect exact source files when producing the LLD or changing the player.