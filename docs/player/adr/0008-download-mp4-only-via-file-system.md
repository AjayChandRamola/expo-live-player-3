# ADR 0008 — Download is MP4-only via expo-file-system

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 |
| Spec | F33, `docs/player/07-app-actions-and-repositories.md` section 5 |

## Context

The Download modal today animates a fake progress bar and never writes a file. `expo-file-system ~19.0.17` is installed and supports resumable downloads (`createDownloadResumable`, `pauseAsync`, `resumeAsync`, `cancelAsync` on the legacy API; the SDK 54 package also ships the new `File`/`Directory` API). expo-video 3.0.11 has no offline-HLS API (no `AVAssetDownloadTask` or ExoPlayer `DownloadManager` binding).

## Decision

Implement `services/videoActions/downloadService.ts` for `kind === "mp4"` sources only: resumable download to `<documentDirectory>/videos/<videoId>.mp4`, progress events, pause/resume/cancel, a persisted registry (`STORAGE_KEYS.downloads`, `"yagna.downloads.v1"`) with states `queued | downloading | paused | completed | failed`, and delete. The Download button is hidden for HLS sources. `VideoPlaybackContainer` prefers a `file://` source when the registry says `completed` and the file exists (`getInfoAsync`).

`PLAYER_FEATURE_FLAGS.download` flips to `true` in the same commit as the passing acceptance tests.

## Alternatives considered

1. **Download HLS by fetching every segment.** Rejected: no playlist rewriting support in expo-video for local segments; large and brittle.
2. **Server-side MP4 transcode for downloads.** Deferred: needs a backend.
3. **Keep the fake modal.** Rejected: fake success violates the functional rules.

## Consequences

- Positive: a real, offline-usable feature without a backend.
- Negative: only MP4 sources can be downloaded; storage usage is the user's; a "Manage downloads" screen is a later app item (the Saved tab could host it).

## Verification

- `__tests__/services/videoActions/downloadService.test.ts` with `expo-file-system` mocked: state transitions, registry persistence, cancel cleans the partial file.
- Manual matrix row: download an MP4, enable airplane mode, play it.
