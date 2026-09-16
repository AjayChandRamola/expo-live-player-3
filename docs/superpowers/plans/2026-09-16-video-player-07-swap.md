# Increment 6 — Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, inline in this session (CLAUDE.md §0 forbids subagents). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-09-16-video-player-00-index.md` first. Increments 4 and 5 must both be merged to `main`.

**Goal:** Make the new player live: `index.tsx` re-exports `Player`, `VideoPlaybackContainer` speaks the new props and renders the action bar, the screen passes fullscreen state, downloaded files play locally, and the manual device matrix is run and recorded.

**Architecture:** One-commit swap with a one-commit rollback (ADR 0001). The container is the only adapter between domain types and `VideoPlayerProps`.

**Tech Stack:** as previous increments.

**Spec:** `docs/player/10-migration-and-swap.md` §4–§5; `docs/player/03-architecture.md` §4.16; `docs/player/09-test-plan.md` §3.6 and §6; `docs/player/07-app-actions-and-repositories.md` §5.5.

## Global Constraints

See the index. Additionally:
- The swap of `index.tsx` and the container update land in **one commit** so the app is never half-swapped.
- `OLD_ROOT_FROZEN` is removed from `ACTIVE_RULES` in the same commit (the old root no longer exists as such).
- Manual matrix rows are recorded as run or not run. No row is marked passed without a device.

---

### Task 1: Container against the new props (test first, with the player mocked)

**Files:**
- Modify: `components/Video/VideoPlaybackContainer.tsx`
- Modify: `__tests__/components/VideoPlaybackContainer.test.tsx`

**Interfaces:**
```ts
export interface VideoPlaybackContainerProps {
  readonly video: Video; readonly source: PlayableSource;
  readonly hasNext: boolean; readonly hasPrevious: boolean; readonly isAutoplayEnabled: boolean;
  readonly isMinimized: boolean; readonly isFullscreen: boolean;
  readonly onNext: () => void; readonly onPrevious: () => void; readonly onFinished: () => void;
  readonly onToggleMinimize: () => void; readonly onToggleAutoplay: (enabled: boolean) => void;
  readonly onFullscreenChange: (isFullscreen: boolean) => void;
}
```

- [ ] **Step 1: Rewrite the container test**

```tsx
// __tests__/components/VideoPlaybackContainer.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { VideoActionsProvider } from "../../components/Video/actions/VideoActionsProvider";
import { VideoPlaybackContainer, type VideoPlaybackContainerProps } from "../../components/Video/VideoPlaybackContainer";
import type { Video } from "../../types/domain";
import type { DownloadService } from "../../services/videoActions/downloadService";

const playerProps: Record<string, unknown>[] = [];
jest.mock("../../components/VideoPlayer", () => {
  const ReactLib = require("react");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      playerProps.push(props);
      return ReactLib.createElement("Player", { testID: "player-mock" });
    },
  };
});
jest.mock("../../components/Video/actions/VideoActionBar", () => {
  const ReactLib = require("react");
  return { VideoActionBar: (props: Record<string, unknown>) => ReactLib.createElement("ActionBar", { testID: "action-bar", ...props }) };
});
const track = jest.fn();
jest.mock("../../services/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));

const video: Video = {
  id: "v1", title: "Gayatri Yagya", thumbnailUrl: "https://x/t.jpg", durationSec: 100, publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna" }, isLive: false, source: { kind: "mp4", url: "https://x/v.mp4" },
  captions: [{ start: 0, end: 1, text: "Om" }], chapters: [{ title: "Intro", startMs: 0 }],
};
function props(o: Partial<VideoPlaybackContainerProps> = {}): VideoPlaybackContainerProps {
  return {
    video, source: { kind: "mp4", url: "https://x/v.mp4" }, hasNext: true, hasPrevious: false, isAutoplayEnabled: true,
    isMinimized: false, isFullscreen: false, onNext: jest.fn(), onPrevious: jest.fn(), onFinished: jest.fn(),
    onToggleMinimize: jest.fn(), onToggleAutoplay: jest.fn(), onFullscreenChange: jest.fn(), ...o,
  };
}
function downloads(localUri: string | null): DownloadService {
  return {
    list: jest.fn(async () => []), get: jest.fn(async () => null), start: jest.fn(), pause: jest.fn(), resume: jest.fn(), cancel: jest.fn(), remove: jest.fn(),
    subscribe: () => () => undefined, resolveLocalUri: jest.fn(async () => localUri),
  } as unknown as DownloadService;
}
function renderContainer(p = props(), localUri: string | null = null) {
  return render(
    <VideoActionsProvider deps={{ downloads: downloads(localUri) }}>
      <VideoPlaybackContainer {...p} />
    </VideoActionsProvider>,
  );
}

beforeEach(() => {
  playerProps.length = 0;
  track.mockClear();
});

describe("VideoPlaybackContainer", () => {
  it("maps domain video and source onto VideoPlayerProps", async () => {
    const p = props();
    renderContainer(p);
    await waitFor(() => expect(playerProps.length).toBeGreaterThan(0));
    const last = playerProps[playerProps.length - 1];
    expect(last).toMatchObject({
      source: { url: "https://x/v.mp4", kind: "mp4", isLive: false, posterUrl: "https://x/t.jpg" },
      title: "Gayatri Yagya",
      captions: video.captions,
      chapters: video.chapters,
      hasNext: true,
      hasPrevious: false,
      isAutoplayNextEnabled: true,
      isMinimized: false,
      onNext: p.onNext,
      onPrevious: p.onPrevious,
      onToggleMinimize: p.onToggleMinimize,
      onToggleAutoplayNext: p.onToggleAutoplay,
      onFullscreenChange: p.onFullscreenChange,
    });
    expect(typeof last.onPositionChange).toBe("function");
    expect(typeof last.onStateChange).toBe("function");
  });

  it("prefers a downloaded file when one exists", async () => {
    renderContainer(props(), "file:///docs/videos/v1.mp4");
    await waitFor(() => expect(playerProps[playerProps.length - 1]?.source).toMatchObject({ url: "file:///docs/videos/v1.mp4", kind: "mp4" }));
    expect(track).toHaveBeenCalledWith("video_start", { videoId: "v1", kind: "mp4", local: true });
  });

  it("renders the action bar below the player, hidden in fullscreen and minimized", async () => {
    const { rerender } = renderContainer();
    await waitFor(() => expect(screen.getByTestId("action-bar")).toBeTruthy());
    expect(screen.getByTestId("action-bar").props).toMatchObject({ videoId: "v1", videoTitle: "Gayatri Yagya", sourceKind: "mp4", channelId: "c1" });
    rerender(<VideoActionsProvider deps={{ downloads: downloads(null) }}><VideoPlaybackContainer {...props({ isFullscreen: true })} /></VideoActionsProvider>);
    expect(screen.queryByTestId("action-bar")).toBeNull();
    rerender(<VideoActionsProvider deps={{ downloads: downloads(null) }}><VideoPlaybackContainer {...props({ isMinimized: true })} /></VideoActionsProvider>);
    expect(screen.queryByTestId("action-bar")).toBeNull();
  });

  it("tracks video_start once per video/source and video_finish on finished", async () => {
    const p = props();
    renderContainer(p);
    await waitFor(() => expect(track).toHaveBeenCalledWith("video_start", { videoId: "v1", kind: "mp4", local: false }));
    const last = playerProps[playerProps.length - 1] as { onFinished: () => void };
    last.onFinished();
    expect(track).toHaveBeenCalledWith("video_finish", { videoId: "v1" });
    expect(p.onFinished).toHaveBeenCalledTimes(1);
  });

  it("throttles video_progress analytics to once per minute", async () => {
    jest.useFakeTimers();
    renderContainer();
    await waitFor(() => expect(playerProps.length).toBeGreaterThan(0));
    const last = playerProps[playerProps.length - 1] as { onPositionChange: (p: number, d: number) => void };
    last.onPositionChange(5_000, 100_000);
    last.onPositionChange(10_000, 100_000);
    expect(track.mock.calls.filter((c) => c[0] === "video_progress")).toHaveLength(1);
    jest.advanceTimersByTime(60_000);
    last.onPositionChange(70_000, 100_000);
    expect(track.mock.calls.filter((c) => c[0] === "video_progress")).toHaveLength(2);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to confirm failure** (`npm test -- --testPathPattern=components/VideoPlaybackContainer` — the current container passes old props), then rewrite the container:

```tsx
// components/Video/VideoPlaybackContainer.tsx
/**
 * The only module outside tests permitted to import components/VideoPlayer.
 * Maps a domain Video and a resolved PlayableSource onto VideoPlayerProps,
 * prefers a downloaded file when one exists, renders the app action bar
 * below the player, and emits analytics. Reads no playback state beyond
 * the callbacks the player exposes.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import VideoPlayer from "../VideoPlayer";
import type { PlaybackSnapshot } from "../VideoPlayer/types";
import { track } from "../../services/analytics";
import type { PlayableSource, Video } from "../../types/domain";
import { VideoActionBar } from "./actions/VideoActionBar";
import { useVideoActionsDeps } from "./actions/VideoActionsProvider";

export interface VideoPlaybackContainerProps {
  readonly video: Video;
  readonly source: PlayableSource;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayEnabled: boolean;
  readonly isMinimized: boolean;
  readonly isFullscreen: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onFinished: () => void;
  readonly onToggleMinimize: () => void;
  readonly onToggleAutoplay: (enabled: boolean) => void;
  readonly onFullscreenChange: (isFullscreen: boolean) => void;
}

const PROGRESS_ANALYTICS_INTERVAL_MS = 60_000;

export function VideoPlaybackContainer(props: VideoPlaybackContainerProps) {
  const { video, source, isFullscreen, isMinimized } = props;
  const { downloads } = useVideoActionsDeps();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const lastTrackedRef = useRef("");
  const lastProgressAtRef = useRef(0);

  // Prefer a completed download; stale-guarded by video id.
  useEffect(() => {
    let alive = true;
    setLocalUri(null);
    downloads.resolveLocalUri(video.id).then((uri) => {
      if (alive) setLocalUri(uri);
    });
    return () => {
      alive = false;
    };
  }, [downloads, video.id]);

  const effectiveUrl = localUri ?? source.url;
  const effectiveKind: "mp4" | "hls" = localUri ? "mp4" : source.kind;

  useEffect(() => {
    const key = `${video.id}:${effectiveUrl}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;
    track("video_start", { videoId: video.id, kind: effectiveKind, local: localUri !== null });
  }, [video.id, effectiveUrl, effectiveKind, localUri]);

  const handleFinished = useCallback(() => {
    track("video_finish", { videoId: video.id });
    props.onFinished();
  }, [props, video.id]);

  const handlePositionChange = useCallback(
    (positionMs: number) => {
      const at = Date.now();
      if (at - lastProgressAtRef.current < PROGRESS_ANALYTICS_INTERVAL_MS) return;
      lastProgressAtRef.current = at;
      track("video_progress", { videoId: video.id, positionMs });
    },
    [video.id],
  );

  const handleStateChange = useCallback(
    (snapshot: PlaybackSnapshot) => {
      // A local file that fails to play falls back to the network source once.
      if (snapshot.status === "error" && localUri !== null) {
        setLocalUri(null);
        void downloads.remove(video.id);
      }
    },
    [downloads, localUri, video.id],
  );

  return (
    <View style={styles.column}>
      <VideoPlayer
        source={{ url: effectiveUrl, kind: effectiveKind, isLive: video.isLive, posterUrl: video.thumbnailUrl }}
        title={video.title}
        captions={video.captions}
        chapters={video.chapters}
        hasNext={props.hasNext}
        hasPrevious={props.hasPrevious}
        isAutoplayNextEnabled={props.isAutoplayEnabled}
        isMinimized={isMinimized}
        onNext={props.onNext}
        onPrevious={props.onPrevious}
        onFinished={handleFinished}
        onToggleMinimize={props.onToggleMinimize}
        onToggleAutoplayNext={props.onToggleAutoplay}
        onFullscreenChange={props.onFullscreenChange}
        onPositionChange={handlePositionChange}
        onStateChange={handleStateChange}
      />
      {!isFullscreen && !isMinimized ? (
        <VideoActionBar videoId={video.id} videoTitle={video.title} videoUrl={source.url} channelId={video.channel.id} sourceKind={source.kind} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ column: { width: "100%" } });
```

Do **not** run the type check yet: `VideoPlayer`'s default export is still the old component until Task 2, so `tsc` will report prop mismatches in this file. The container test passes because it mocks the player. Proceed to Task 2 immediately and commit both together.

---

### Task 2: The swap commit

**Files:**
- Modify: `components/VideoPlayer/index.tsx` (replace entirely)
- Modify: `app/video/[id].tsx` (pass `isFullscreen` and `onToggleAutoplay`)
- Modify: `__tests__/screens/VideoScreen.test.tsx` (new container props)
- Modify: `__tests__/player/invariants.test.ts` (remove `OLD_ROOT_FROZEN`; R3 allowed list unchanged)
- Move: `__tests__/player/VideoPlayer.render.test.tsx` → `docs/history/videoplayer/2026-09-16-pre-redesign/__tests__/VideoPlayer.render.test.tsx` (it characterizes the old root, which no longer exists; the parity suite replaces it)

- [ ] **Step 1: Replace `index.tsx`**

```ts
// components/VideoPlayer/index.tsx
// Public entry of the player. The composition root lives in Player.tsx.
export { Player as default } from "./Player";
export type { VideoPlayerProps, VideoPlayerSource } from "./types";
export type { PlaybackSnapshot, PlaybackStatus, PlaybackError, PlaybackCommands } from "./engine/types";
```

- [ ] **Step 2: Screen**

In `app/video/[id].tsx`:
- add `isFullscreen={isFullscreen}` to `<VideoPlaybackContainer …>`;
- add `onToggleAutoplay={queue.setAutoplay}` (the `PlayQueueContext` already exposes `setAutoplay(enabled)`; if `SettingsContext` persists autoplay, call both: `onToggleAutoplay={(enabled) => { queue.setAutoplay(enabled); settings.setAutoplay(enabled); }}` — check `contexts/SettingsContext.tsx` for the setter name and use it exactly).

- [ ] **Step 3: Tests**

- `__tests__/screens/VideoScreen.test.tsx`: update the container mock/expectations for the two new props.
- `__tests__/player/invariants.test.ts`: `ACTIVE_RULES` becomes `["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R9"]`; delete the `OLD_ROOT_BASELINE` constant.
- Move the old characterization file to history with `git mv`.

- [ ] **Step 4: Gate**

```bash
npm test 2>&1 | tail -6
npm run test:web 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm test -- --testPathPattern=invariants
grep -rn "components/VideoPlayer" app components --include=*.tsx | grep -v VideoPlaybackContainer | grep -v "^components/VideoPlayer/"
```
Expected: all green; `tsc` count equals the pre-existing baseline; the last grep prints nothing.

- [ ] **Step 5: Commit (container + index + screen + tests together)**

```bash
git add components/VideoPlayer/index.tsx components/Video/VideoPlaybackContainer.tsx app/video/\[id\].tsx __tests__/components/VideoPlaybackContainer.test.tsx __tests__/screens/VideoScreen.test.tsx __tests__/player/invariants.test.ts docs/history/videoplayer
git commit -m "feat(player): swap to the redesigned player behind VideoPlaybackContainer

index.tsx now re-exports Player. The container maps domain types onto
VideoPlayerProps, prefers downloaded files, and renders the action bar.
Rollback: revert this commit (ADR 0001).

Verified: npm test => <N> suites passed
Verified: npm run lint => 0 errors
Verified: npx tsc --noEmit => <N> errors (pre-existing only)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Rollback rehearsal

- [ ] **Step 1:** `git revert --no-edit HEAD` → run `npm test` → expect the pre-swap state green (old root back, old container test back). Record the result.
- [ ] **Step 2:** `git revert --no-edit HEAD` (revert the revert) → run `npm test` → green again.
- [ ] **Step 3:** Record in the report: "Rollback rehearsed: revert <swap-sha> restores the old player; suite green in both states."

---

### Task 4: Manual device matrix

Run every row of `docs/player/09-test-plan.md` §6 on at least one Android device and one iOS device (web in Chrome and Safari if available). Use a development build (`npx expo start` with a dev client or Expo Go if all modules are supported — expo-brightness and expo-video are; record which). For each row write `run: pass`, `run: fail (notes)`, or `not run (reason)`.

Also measure P1, P2, P4, P5 for the **new** player with the procedure in `docs/player/08-reliability-and-performance.md` §2 and compare with the Increment 0 baseline file.

If no device is available in this session, every row is `not run (no device)` and the report says so; the swap still merges on the automated gate, but Increment 7 must not flip `download` or `pictureInPicture` to `true` until M19 and M23 are run (see `10-migration-and-swap.md` §6).

---

### Task 5: Report and merge

Create `docs/superpowers/plans/2026-09-16-video-player-07-report.md` with: gate numbers; the rollback rehearsal; the full manual matrix table; the P1–P9 table (new player vs baseline); open items O1–O6 status; "Not done" list.

```bash
git add docs/superpowers/plans/2026-09-16-video-player-07-report.md
git commit -m "docs: Increment 6 swap report with manual matrix and performance table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Increment 6 exit criteria (`10-migration-and-swap.md` §1): automated gate green; manual matrix recorded; rollback rehearsed. Merge to `main`.
