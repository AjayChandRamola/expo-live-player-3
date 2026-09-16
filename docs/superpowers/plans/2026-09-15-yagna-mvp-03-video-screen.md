# Increment 3 — Video Screen and Playback Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first**, especially sections 5.7 and 5.9. This increment implements the HLD's most important boundary.

**Goal:** Put a single, thin component between the app and the existing player, narrow the shared context to a play queue, and rebuild the video screen on services with every load state handled.

**Architecture:** `VideoPlaybackContainer` is the only module outside tests that imports `components/VideoPlayer`. It maps a domain `Video` plus a resolved `PlayableSource` onto the player's frozen prop surface and lifts exactly two events. The screen owns resolution, states, and navigation. The context owns only queue position and the autoplay flag.

**Tech Stack:** Expo Router 6, expo-video via the existing player, React Native Testing Library 13.3.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md`, sections B.3, B.6, E.2, F.4, F.5, and ADR 1.

**Depends on:** Increment 0B (the player must render without throwing), Increment 1 (services, resolver, `useLoadable`, `StateView`), Increment 2 (navigation).

---

## Global Constraints

All constraints from the LLD index apply. Specific to this increment:

- **The player's prop surface is frozen.** Do not add, remove, or rename a prop on `components/VideoPlayer`.
- **`videoId` must always be a non-empty string** when rendering the container. The player hides its action bar and progress bar when `videoId` is falsy, at `components/VideoPlayer/index.tsx:909` and `:946`.
- The container reads no playback state. The player exposes none, and the MVP needs none.
- `components/Shorts/` is untouched.

---

### Task 1: Narrow `VideoPlayerContext` into `PlayQueueContext`

**Files:**
- Create: `contexts/PlayQueueContext.tsx`
- Delete: `contexts/VideoPlayerContext.tsx` (after consumers move)
- Test: `__tests__/contexts/PlayQueueContext.test.tsx`

**Interfaces:**
- Produces: `PlayQueueProvider` and `usePlayQueue()` exactly as declared in LLD index section 5.7.

**What changes from the old context:** `homeScrollPosition` and `saveHomeScrollPosition` are dropped, because navigation state belongs to the router and the list already restores its own offset. `setVideoList` plus `playVideoById` collapse into `setQueue(videos, startId)`, which removes the window where the list is set but no current video is selected. `videoList` becomes `queue`, and its element type becomes the domain `Video`.

**What is deliberately preserved:** `playNext`, `playPrevious`, `hasNext`, `hasPrevious`, and the autoplay flag keep the same names and semantics, so the player's navigation buttons keep working without a change.

- [ ] **Step 1: Write the failing test**

Create `__tests__/contexts/PlayQueueContext.test.tsx`:

```tsx
// __tests__/contexts/PlayQueueContext.test.tsx
import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { PlayQueueProvider, usePlayQueue } from "../../contexts/PlayQueueContext";
import type { Video } from "../../types/domain";

function video(id: string): Video {
  return {
    id,
    title: `Video ${id}`,
    thumbnailUrl: "https://cdn.test/t.jpg",
    durationSec: 60,
    publishedAt: "2026-01-01T00:00:00Z",
    channel: { id: "c1", name: "Yagna" },
    isLive: false,
    source: { kind: "mp4", url: "https://cdn.test/a.mp4" },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlayQueueProvider>{children}</PlayQueueProvider>
);

describe("PlayQueueContext", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    expect(result.current.queue).toEqual([]);
    expect(result.current.currentVideo).toBeNull();
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrevious).toBe(false);
  });

  it("selects the first video when no start id is given", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a"), video("b")]));
    expect(result.current.currentVideo?.id).toBe("a");
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrevious).toBe(false);
  });

  it("selects the requested start id", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a"), video("b"), video("c")], "b"));
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrevious).toBe(true);
  });

  it("falls back to the first entry when the start id is not in the queue", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a")], "missing"));
    expect(result.current.currentVideo?.id).toBe("a");
  });

  it("advances and retreats through the queue", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a"), video("b")]));

    act(() => {
      expect(result.current.playNext()).toBe(true);
    });
    expect(result.current.currentVideo?.id).toBe("b");

    act(() => {
      expect(result.current.playPrevious()).toBe(true);
    });
    expect(result.current.currentVideo?.id).toBe("a");
  });

  it("returns false at each end instead of wrapping", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a")]));

    act(() => {
      expect(result.current.playNext()).toBe(false);
      expect(result.current.playPrevious()).toBe(false);
    });
    expect(result.current.currentVideo?.id).toBe("a");
  });

  it("plays by id", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a"), video("b")]));
    act(() => result.current.playById("b"));
    expect(result.current.currentIndex).toBe(1);
  });

  it("ignores playById for an id that is not queued", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a")]));
    act(() => result.current.playById("nope"));
    expect(result.current.currentVideo?.id).toBe("a");
  });

  it("toggles autoplay, defaulting to on", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    expect(result.current.isAutoplayEnabled).toBe(true);
    act(() => result.current.setAutoplay(false));
    expect(result.current.isAutoplayEnabled).toBe(false);
  });

  it("handles an empty queue without throwing", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => {
      result.current.setQueue([]);
      expect(result.current.playNext()).toBe(false);
    });
    expect(result.current.currentVideo).toBeNull();
  });

  it("throws a clear error when used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => usePlayQueue())).toThrow(/PlayQueueProvider/);
    spy.mockRestore();
  });

  it("does not expose a home scroll position", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    expect(result.current).not.toHaveProperty("homeScrollPosition");
    expect(result.current).not.toHaveProperty("saveHomeScrollPosition");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=PlayQueueContext
```

- [ ] **Step 3: Write the context**

Create `contexts/PlayQueueContext.tsx` implementing the interface from LLD index section 5.7.

Use a single `useState` holding `{ queue, currentIndex }` so the two can never disagree. Derive `currentVideo`, `hasNext`, and `hasPrevious` at render rather than storing them. Keep `isAutoplayEnabled` in its own state, defaulting to `true`; Increment 6 seeds it from stored settings.

`playNext` and `playPrevious` must return a boolean synchronously while also updating state. Compute the outcome from the current state before calling the setter rather than reading a value assigned inside the updater, which is what makes the old context's return value unreliable.

Wrap the context value in `useMemo` keyed on the state and the stable callbacks, so consumers do not re-render on every provider render.

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=PlayQueueContext
```
Expected: 12 passed.

- [ ] **Step 5: Move the two consumers**

`app/_layout.tsx` and `app/(tabs)/index.tsx` still use `VideoPlayerProvider` and `useVideoPlayerContext` (both carry a `TODO(Increment 3)` marker from Increment 2).

In `app/_layout.tsx`, swap the import and the wrapper to `PlayQueueProvider`.

In `app/(tabs)/index.tsx`, replace `const { setVideoList, playVideoById } = useVideoPlayerContext()` with `const { setQueue } = usePlayQueue()`, and change the press handler to a single call:

```ts
setQueue(latest, video.id);
router.push(`/video/${encodeURIComponent(video.id)}`);
```

- [ ] **Step 6: Delete the old context**

```bash
grep -rn "VideoPlayerContext\|useVideoPlayerContext" app components contexts hooks services --include=*.ts --include=*.tsx
```
Expected: only `app/video/[id].tsx`, which Task 4 rewrites. Leave the file in place until then and delete it at the end of Task 4.

- [ ] **Step 7: Commit**

```bash
git add contexts/PlayQueueContext.tsx app/_layout.tsx app/\(tabs\)/index.tsx __tests__/contexts/PlayQueueContext.test.tsx
git commit -m "feat: narrow VideoPlayerContext into PlayQueueContext

Drops the home scroll position, which belongs to the router and the list,
and collapses setVideoList plus playVideoById into one setQueue call so the
queue and its index can never disagree. Next, previous, and autoplay keep
their names and semantics so the player's buttons are unaffected.

Verified: npm test -- --testPathPattern=PlayQueueContext => 12 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Supporting services for the video screen

**Files:**
- Create: `services/shareLinkService.ts`
- Create: `services/analytics.ts`
- Test: `__tests__/services/shareLinkService.test.ts`

**Interfaces:**
- Produces: `forVideo(id)`, `forLive()`, `track(event, props)` as declared in LLD index section 5.6.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/shareLinkService.test.ts`:

```ts
// __tests__/services/shareLinkService.test.ts
import { forVideo, forLive } from "../../services/shareLinkService";
import { LINKS } from "../../constants/config";

describe("shareLinkService", () => {
  it("builds a video link on the app scheme", () => {
    expect(forVideo("abc123")).toBe(`${LINKS.scheme}://${LINKS.videoPath}/abc123`);
  });

  it("builds the live link", () => {
    expect(forLive()).toBe(`${LINKS.scheme}://${LINKS.livePath}`);
  });

  it("percent-encodes an id containing separators", () => {
    const link = forVideo("a/b c");
    expect(link).not.toContain(" ");
    expect(link).toContain("a%2Fb%20c");
  });

  it("encodes an id that tries to traverse the path", () => {
    const link = forVideo("../../admin");
    expect(link).not.toContain("../");
  });

  it("encodes an id carrying a query separator", () => {
    expect(forVideo("a?b=c")).not.toContain("?b=");
  });
});
```

- [ ] **Step 2: Run it, then implement both services**

`forVideo` must use `encodeURIComponent` on the id. `forLive` takes no input.

`services/analytics.ts` exports `track` as a no-op that logs through `Logger.info` in development and does nothing in production. It accepts only the three events in the `AnalyticsEvent` union and a `Record<string, string | number | boolean>`. It must never receive or log a URL or anything identifying a person, so document that in a header comment.

- [ ] **Step 3: Run the tests and commit**

Run:
```bash
npm test -- --testPathPattern=shareLinkService
```
Expected: 5 passed.

```bash
git add services/shareLinkService.ts services/analytics.ts __tests__/services/shareLinkService.test.ts
git commit -m "feat: add share link builder and a no-op analytics sink

Ids are percent-encoded so a crafted id cannot traverse or inject into the
deep link. Analytics is a typed no-op with three events and no personal data.

Verified: npm test -- --testPathPattern=shareLinkService => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The playback container

**Files:**
- Create: `components/Video/VideoPlaybackContainer.tsx`
- Test: `__tests__/components/VideoPlaybackContainer.test.tsx`

**Interfaces:**
- Consumes: `components/VideoPlayer` (default export), `Video` and `PlayableSource` from `types/domain`, `track` from `services/analytics`.
- Produces: `VideoPlaybackContainer` with the props in LLD index section 5.9.

**This is the boundary the whole HLD rests on.** The test mocks the player and asserts the mapping, which is what keeps the two sides independent.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/VideoPlaybackContainer.test.tsx`:

```tsx
// __tests__/components/VideoPlaybackContainer.test.tsx
import React from "react";
import { render, act } from "@testing-library/react-native";
import { VideoPlaybackContainer } from "../../components/Video/VideoPlaybackContainer";
import type { PlayableSource, Video } from "../../types/domain";

// Capture the props the container hands to the player.
const playerProps: Record<string, unknown>[] = [];
jest.mock("../../components/VideoPlayer", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    playerProps.push(props);
    return null;
  },
}));

jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
import { track } from "../../services/analytics";

const video: Video = {
  id: "v1",
  title: "Gayatri Yagya",
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 600,
  publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna" },
  isLive: false,
  source: { kind: "hls", url: "https://cdn.test/a.m3u8" },
  captions: [{ start: 0, end: 1000, text: "Om" }],
  chapters: [{ title: "Opening", startMs: 0 }],
};

const source: PlayableSource = { kind: "hls", url: "https://cdn.test/a.m3u8" };

const baseProps = {
  video,
  source,
  hasNext: true,
  hasPrevious: false,
  isAutoplayEnabled: true,
  isMinimized: false,
  onNext: jest.fn(),
  onPrevious: jest.fn(),
  onFinished: jest.fn(),
  onToggleMinimize: jest.fn(),
  onFullscreenChange: jest.fn(),
};

function lastProps() {
  return playerProps[playerProps.length - 1];
}

describe("VideoPlaybackContainer", () => {
  beforeEach(() => {
    playerProps.length = 0;
    jest.clearAllMocks();
  });

  it("maps the resolved source url onto sourceUrl", () => {
    render(<VideoPlaybackContainer {...baseProps} />);
    expect(lastProps().sourceUrl).toBe(source.url);
  });

  it("maps queue flags onto the player's navigation props", () => {
    render(<VideoPlaybackContainer {...baseProps} />);
    expect(lastProps().hasNextVideo).toBe(true);
    expect(lastProps().hasPreviousVideo).toBe(false);
  });

  it("passes a non-empty videoId so the action bar renders", () => {
    render(<VideoPlaybackContainer {...baseProps} />);
    expect(lastProps().videoId).toBe("v1");
    expect(String(lastProps().videoId).length).toBeGreaterThan(0);
  });

  it("maps title, channel, and url metadata", () => {
    render(<VideoPlaybackContainer {...baseProps} />);
    expect(lastProps().videoTitle).toBe("Gayatri Yagya");
    expect(lastProps().channelId).toBe("c1");
    expect(lastProps().videoUrl).toBe(source.url);
  });

  it("forwards captions and chapters", () => {
    render(<VideoPlaybackContainer {...baseProps} />);
    expect(lastProps().captions).toEqual(video.captions);
    expect(lastProps().chapters).toEqual(video.chapters);
  });

  it("forwards the autoplay flag", () => {
    render(<VideoPlaybackContainer {...baseProps} isAutoplayEnabled={false} />);
    expect(lastProps().isAutoplayEnabled).toBe(false);
  });

  it("lifts the finished event", () => {
    const onFinished = jest.fn();
    render(<VideoPlaybackContainer {...baseProps} onFinished={onFinished} />);
    act(() => {
      (lastProps().onVideoFinished as () => void)();
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("lifts the fullscreen event with its flag", () => {
    const onFullscreenChange = jest.fn();
    render(<VideoPlaybackContainer {...baseProps} onFullscreenChange={onFullscreenChange} />);
    act(() => {
      (lastProps().onFullscreenChange as (v: boolean) => void)(true);
    });
    expect(onFullscreenChange).toHaveBeenCalledWith(true);
  });

  it("wires next and previous to the player's navigation callbacks", () => {
    const onNext = jest.fn();
    const onPrevious = jest.fn();
    render(<VideoPlaybackContainer {...baseProps} onNext={onNext} onPrevious={onPrevious} />);
    act(() => {
      (lastProps().onNavigateToNext as () => void)();
      (lastProps().onNavigateToPrevious as () => void)();
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("tracks video_start once per mount", () => {
    render(<VideoPlaybackContainer {...baseProps} />);
    expect(track).toHaveBeenCalledWith("video_start", expect.objectContaining({ videoId: "v1" }));
  });

  it("tracks video_finish when playback ends", () => {
    render(<VideoPlaybackContainer {...baseProps} />);
    act(() => {
      (lastProps().onVideoFinished as () => void)();
    });
    expect(track).toHaveBeenCalledWith("video_finish", expect.objectContaining({ videoId: "v1" }));
  });

  it("tracks a new start when the source changes", () => {
    const { rerender } = render(<VideoPlaybackContainer {...baseProps} />);
    expect(track).toHaveBeenCalledTimes(1);

    const next = { ...video, id: "v2" };
    rerender(
      <VideoPlaybackContainer
        {...baseProps}
        video={next}
        source={{ kind: "mp4", url: "https://cdn.test/b.mp4" }}
      />,
    );
    expect(track).toHaveBeenCalledWith("video_start", expect.objectContaining({ videoId: "v2" }));
  });

  it("does not pass any prop outside the frozen surface", () => {
    render(<VideoPlaybackContainer {...baseProps} />);
    const allowed = new Set([
      "sourceUrl",
      "autoplay",
      "buttonSize",
      "hasPreviousVideo",
      "hasNextVideo",
      "onNavigateToPrevious",
      "onNavigateToNext",
      "isMinimized",
      "onToggleMinimize",
      "onFullscreenChange",
      "isAutoplayEnabled",
      "onVideoFinished",
      "captions",
      "chapters",
      "hideControlsTimeout",
      "theme",
      "videoId",
      "videoTitle",
      "videoUrl",
      "channelId",
    ]);
    for (const key of Object.keys(lastProps())) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=VideoPlaybackContainer
```

- [ ] **Step 3: Write the container**

Create `components/Video/VideoPlaybackContainer.tsx`. It renders exactly one element, `<VideoPlayer />`, with no wrapping `View`.

Fire `track("video_start", { videoId, kind })` from a `useEffect` keyed on `[video.id, source.url]`. Fire `track("video_finish", { videoId })` inside the `onVideoFinished` handler before calling `props.onFinished()`.

Add a file header stating that this is the only module outside tests permitted to import `components/VideoPlayer`, and that the player's prop surface is frozen.

The last test is the guard rail: it fails the moment someone adds an undocumented prop. Do not weaken it.

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=VideoPlaybackContainer
```
Expected: 13 passed.

- [ ] **Step 5: Commit**

```bash
git add components/Video/VideoPlaybackContainer.tsx __tests__/components/VideoPlaybackContainer.test.tsx
git commit -m "feat: add VideoPlaybackContainer, the single player boundary

Maps a domain Video and a resolved PlayableSource onto the player's frozen
prop surface and lifts exactly two events, finished and fullscreen. A test
asserts no prop outside the documented surface is ever passed, so the
boundary cannot drift silently.

Verified: npm test -- --testPathPattern=VideoPlaybackContainer => 13 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `useVideoDetail` and `useRelatedVideos`

**Files:**
- Create: `hooks/useVideoDetail.ts`
- Create: `hooks/useRelatedVideos.ts`
- Test: `__tests__/hooks/useVideoDetail.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface VideoDetail {
  readonly video: Video;
  readonly source: PlayableSource;
}
export function useVideoDetail(id: string | undefined): Loadable<VideoDetail>;
export function useRelatedVideos(id: string | undefined): Loadable<Video[]>;
```

`useVideoDetail` fetches the video and resolves its source in one step, so the screen receives either a playable pair or a typed error, never a video with an unplayable URL.

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useVideoDetail.test.tsx`:

```tsx
// __tests__/hooks/useVideoDetail.test.tsx
import { renderHook, waitFor } from "@testing-library/react-native";
import { useVideoDetail } from "../../hooks/useVideoDetail";
import * as contentService from "../../services/contentService";
import * as resolver from "../../services/mediaSourceResolver";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("../../services/contentService");
jest.mock("../../services/mediaSourceResolver");

const content = contentService as jest.Mocked<typeof contentService>;
const media = resolver as jest.Mocked<typeof resolver>;

const video: Video = {
  id: "v1",
  title: "Gayatri Yagya",
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 600,
  publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna" },
  isLive: false,
  source: { kind: "hls", url: "https://cdn.test/a.m3u8" },
};

describe("useVideoDetail", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns the video with its resolved source", async () => {
    content.getVideoById.mockResolvedValue(video);
    media.resolvePlayable.mockReturnValue({ kind: "hls", url: video.source.url });

    const { result } = renderHook(() => useVideoDetail("v1"));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.video.id).toBe("v1");
    expect(result.current.data?.source.url).toBe(video.source.url);
  });

  it("reports error with not_found for an unknown id", async () => {
    content.getVideoById.mockRejectedValue(makeError("not_found"));
    const { result } = renderHook(() => useVideoDetail("missing"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("not_found");
  });

  it("surfaces a resolver rejection rather than playing an unchecked url", async () => {
    content.getVideoById.mockResolvedValue(video);
    media.resolvePlayable.mockImplementation(() => {
      throw makeError("invalid_source");
    });

    const { result } = renderHook(() => useVideoDetail("v1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("invalid_source");
  });

  it("reports offline on a network failure", async () => {
    content.getVideoById.mockRejectedValue(makeError("network"));
    const { result } = renderHook(() => useVideoDetail("v1"));
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });

  it("stays idle and fetches nothing without an id", () => {
    const { result } = renderHook(() => useVideoDetail(undefined));
    expect(result.current.status).toBe("idle");
    expect(content.getVideoById).not.toHaveBeenCalled();
  });

  it("refetches when the id changes", async () => {
    content.getVideoById.mockResolvedValue(video);
    media.resolvePlayable.mockReturnValue({ kind: "hls", url: video.source.url });

    const { rerender } = renderHook(({ id }) => useVideoDetail(id), {
      initialProps: { id: "v1" },
    });
    await waitFor(() => expect(content.getVideoById).toHaveBeenCalledWith("v1"));

    rerender({ id: "v2" });
    await waitFor(() => expect(content.getVideoById).toHaveBeenCalledWith("v2"));
  });
});
```

- [ ] **Step 2: Run it, then implement both hooks**

Build each on `useLoadable`. Wrap the `load` callback in `useCallback` keyed on the id, or `useLoadable`'s effect will re-run on every render. Pass `enabled: Boolean(id)`.

In `useVideoDetail`'s `load`, `await getVideoById(id)` then call `resolvePlayable(video)` inside the same `try`, so a resolver throw becomes the promise rejection `useLoadable` maps to a status.

`useRelatedVideos` calls `getRelated(id)` with `isEmpty: (list) => list.length === 0`.

- [ ] **Step 3: Run the tests and commit**

Run:
```bash
npm test -- --testPathPattern=useVideoDetail
```
Expected: 6 passed.

```bash
git add hooks/useVideoDetail.ts hooks/useRelatedVideos.ts __tests__/hooks/useVideoDetail.test.tsx
git commit -m "feat: add useVideoDetail and useRelatedVideos

useVideoDetail fetches and resolves in one step, so the screen receives a
playable pair or a typed error and never a video with an unchecked URL.

Verified: npm test -- --testPathPattern=useVideoDetail => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `VideoMeta`

**Files:**
- Create: `components/Video/VideoMeta.tsx`
- Test: `__tests__/components/VideoMeta.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface VideoMetaProps {
  readonly video: Video;
  readonly testID?: string;
}
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/VideoMeta.test.tsx`:

```tsx
// __tests__/components/VideoMeta.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { VideoMeta } from "../../components/Video/VideoMeta";
import type { Video } from "../../types/domain";

const video: Video = {
  id: "v1",
  title: "Gayatri Yagya",
  description: "A long description. ".repeat(40),
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 600,
  publishedAt: "2026-01-01T00:00:00Z",
  viewCount: 1234,
  channel: { id: "c1", name: "Yagna Vishnu Bhagwan" },
  isLive: false,
  source: { kind: "hls", url: "https://cdn.test/a.m3u8" },
};

describe("VideoMeta", () => {
  it("shows the title and channel", () => {
    render(<VideoMeta video={video} testID="meta" />);
    expect(screen.getByText("Gayatri Yagya")).toBeTruthy();
    expect(screen.getByText("Yagna Vishnu Bhagwan")).toBeTruthy();
  });

  it("expands and collapses the description", () => {
    render(<VideoMeta video={video} testID="meta" />);
    const toggle = screen.getByTestId("meta-description-toggle");

    const collapsed = screen.getByTestId("meta-description").props.numberOfLines;
    fireEvent.press(toggle);
    expect(screen.getByTestId("meta-description").props.numberOfLines).not.toBe(collapsed);
  });

  it("omits the description section when there is none", () => {
    render(<VideoMeta video={{ ...video, description: undefined }} testID="meta" />);
    expect(screen.queryByTestId("meta-description")).toBeNull();
  });

  it("renders without a view count", () => {
    expect(() =>
      render(<VideoMeta video={{ ...video, viewCount: undefined }} testID="meta" />),
    ).not.toThrow();
  });

  it("does not crash on an unparseable published date", () => {
    expect(() =>
      render(<VideoMeta video={{ ...video, publishedAt: "not-a-date" }} testID="meta" />),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it, build the component, run again, commit**

Collapse the description to `numberOfLines={3}` and expand to `undefined` on press. Guard date formatting with a validity check so an unparseable string renders as an empty string rather than `Invalid Date`. All styling from `constants/tokens`.

Run:
```bash
npm test -- --testPathPattern=VideoMeta
```
Expected: 5 passed.

```bash
git add components/Video/VideoMeta.tsx __tests__/components/VideoMeta.test.tsx
git commit -m "feat: add VideoMeta with an expandable description

Verified: npm test -- --testPathPattern=VideoMeta => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Rebuild the video screen

**Files:**
- Modify: `app/video/[id].tsx` (replace its contents)
- Delete: `contexts/VideoPlayerContext.tsx`
- Delete: `services/videoService.ts`
- Test: `__tests__/screens/VideoScreen.test.tsx`

**What is removed and why:** the current screen is 723 lines holding a hard-coded `SAFE_VIDEO_CATALOG`, its own URL validation, a help dialog explaining the debug query parameter, and a fallback that plays the first catalogue entry whenever an id is unknown. That fallback is the defect behind the HLD's architecture issue C: a broken link silently plays unrelated content. All of it moves to services created in Increment 1.

Today the screen also has six type errors, including three from `headerBackTitleVisible`, which Expo Router 6 does not accept.

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/VideoScreen.test.tsx`:

```tsx
// __tests__/screens/VideoScreen.test.tsx
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import VideoScreen from "../../app/video/[id]";
import * as detail from "../../hooks/useVideoDetail";
import * as related from "../../hooks/useRelatedVideos";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

const push = jest.fn();
const setParams = jest.fn();
let routeParams: Record<string, string> = { id: "v1" };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => routeParams,
  useRouter: () => ({ push, back: jest.fn(), replace: jest.fn(), setParams }),
  Stack: { Screen: () => null },
}));

const containerProps: Record<string, unknown>[] = [];
jest.mock("../../components/Video/VideoPlaybackContainer", () => ({
  VideoPlaybackContainer: (props: Record<string, unknown>) => {
    containerProps.push(props);
    return null;
  },
}));

const playNext = jest.fn().mockReturnValue(true);
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({
    queue: [],
    currentIndex: 0,
    currentVideo: null,
    hasNext: true,
    hasPrevious: false,
    isAutoplayEnabled: true,
    setQueue: jest.fn(),
    playById: jest.fn(),
    playNext,
    playPrevious: jest.fn(),
    setAutoplay: jest.fn(),
  }),
}));

jest.mock("../../hooks/useVideoDetail");
jest.mock("../../hooks/useRelatedVideos");

const mockedDetail = detail as jest.Mocked<typeof detail>;
const mockedRelated = related as jest.Mocked<typeof related>;

const video: Video = {
  id: "v1",
  title: "Gayatri Yagya",
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 600,
  publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna" },
  isLive: false,
  source: { kind: "hls", url: "https://cdn.test/a.m3u8" },
};

function mockDetail(overrides: Record<string, unknown>) {
  mockedDetail.useVideoDetail.mockReturnValue({
    status: "success",
    data: { video, source: { kind: "hls", url: video.source.url } },
    error: null,
    retry: jest.fn(),
    ...overrides,
  } as ReturnType<typeof detail.useVideoDetail>);
}

describe("VideoScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    containerProps.length = 0;
    routeParams = { id: "v1" };
    mockedRelated.useRelatedVideos.mockReturnValue({
      status: "success",
      data: [],
      error: null,
      retry: jest.fn(),
    } as ReturnType<typeof related.useRelatedVideos>);
  });

  it("renders the player container once the video resolves", () => {
    mockDetail({});
    render(<VideoScreen />);
    expect(containerProps).toHaveLength(1);
    expect(containerProps[0].source).toEqual({ kind: "hls", url: video.source.url });
  });

  it("shows a loading state while resolving", () => {
    mockDetail({ status: "loading", data: null });
    render(<VideoScreen />);
    expect(screen.getByTestId("video-state-loading")).toBeTruthy();
  });

  it("shows a not-found state instead of playing another video", () => {
    mockDetail({ status: "error", data: null, error: makeError("not_found") });
    render(<VideoScreen />);
    expect(screen.getByText(makeError("not_found").message)).toBeTruthy();
    expect(containerProps).toHaveLength(0);
  });

  it("shows an invalid-source state without mounting the player", () => {
    mockDetail({ status: "error", data: null, error: makeError("invalid_source") });
    render(<VideoScreen />);
    expect(containerProps).toHaveLength(0);
  });

  it("shows an offline state with retry", () => {
    const retry = jest.fn();
    mockDetail({ status: "offline", data: null, error: makeError("network"), retry });
    render(<VideoScreen />);
    fireEvent.press(screen.getByTestId("video-state-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("advances the queue when playback finishes and autoplay is on", () => {
    mockDetail({});
    render(<VideoScreen />);
    act(() => {
      (containerProps[0].onFinished as () => void)();
    });
    expect(playNext).toHaveBeenCalledTimes(1);
  });

  it("hides the metadata section in fullscreen", () => {
    mockDetail({});
    render(<VideoScreen />);
    expect(screen.getByTestId("video-meta")).toBeTruthy();

    act(() => {
      (containerProps[0].onFullscreenChange as (v: boolean) => void)(true);
    });
    expect(screen.queryByTestId("video-meta")).toBeNull();
  });

  it("treats a missing route id as not found", () => {
    routeParams = {};
    mockDetail({ status: "error", data: null, error: makeError("not_found") });
    render(<VideoScreen />);
    expect(containerProps).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=VideoScreen
```

- [ ] **Step 3: Replace `app/video/[id].tsx`**

Structure:

1. Read `id` from `useLocalSearchParams`. Sanitize it: trim, strip control characters, cap at 64 characters. If it is empty, pass `undefined` to the hook.
2. `const { status, data, error, retry } = useVideoDetail(safeId)`.
3. `const relatedResult = useRelatedVideos(safeId)`.
4. `const queue = usePlayQueue()`.
5. Local state: `isMinimized`, `isFullscreen`.
6. Render `StateView` with `testID="video-state"` and return early when the status is not `success`.
7. On success render, in order: `VideoPlaybackContainer`; then, when not fullscreen, `VideoMeta` with `testID="video-meta"` and `UpNextList` fed from `relatedResult.data`.
8. `onFinished` calls `queue.playNext()` only when `queue.isAutoplayEnabled`.
9. `onNext` and `onPrevious` call `queue.playNext()` and `queue.playPrevious()`, then `router.setParams({ id: newId })` so the stack does not grow.
10. `onFullscreenChange` sets the local flag.

**Do not** reintroduce the `?url=` parameter, the help dialog, the local catalogue, or the unknown-id fallback. In production the route accepts an id and nothing else.

Register header options through `Stack.Screen` using only options Expo Router 6 supports. `headerBackTitleVisible` is not one; use `headerBackTitle` or omit it.

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=VideoScreen
npx tsc --noEmit 2>&1 | grep -c "app/video"
```
Expected: 8 passed and `0` type errors in the video screen (was 6).

- [ ] **Step 5: Remove the superseded modules**

```bash
grep -rn "VideoPlayerContext\|videoService" app components contexts hooks services --include=*.ts --include=*.tsx
```
Expected: no hits outside the two files themselves. `components/VideoFeed/VideoFeed.tsx` imports `fetchVideoFeed` and `searchVideos` from `services/videoService`; repoint those to `contentService` before deleting.

Then:
```bash
git rm contexts/VideoPlayerContext.tsx services/videoService.ts
```

- [ ] **Step 6: Verify the whole app**

Run:
```bash
npm test
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm start
```
Confirm on a device: a video opens from Home, plays, next and previous work, autoplay advances, fullscreen hides the metadata, and back returns to Home.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: rebuild the video screen on services and the playback container

Replaces a 723-line screen that held a hard-coded catalogue, its own URL
validation, a debug query parameter, and a fallback that played the first
catalogue entry whenever an id was unknown. An unknown id is now a
not-found state, and an unresolvable source never mounts the player.

Verified: npm test -- --testPathPattern=VideoScreen => 8 passed
Verified: type errors in app/video/[id].tsx 6 => 0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Wire Share to the system share sheet

**Files:**
- Modify: `components/VideoPlayer/modals/VideoShareSheet.tsx`
- Test: `__tests__/player/VideoShareSheet.test.tsx`

**This is a protected-module change**, the second of the two permitted outside Increment 0B. Follow `docs/engineering/video-player.md`: read the file and its caller first, change the least possible, test, and report.

**Why:** Share is a Must-Have in the HLD's section J, and section F.5 assigns it to `shareLinkService` plus the operating system's own share sheet. The existing sheet offers in-app share targets that lead nowhere. A share must produce a link that actually reopens the app at the right place.

- [ ] **Step 1: Read the sheet and its caller**

Run:
```bash
sed -n '1,70p' components/VideoPlayer/modals/VideoShareSheet.tsx
grep -n "VideoShareSheet" components/VideoPlayer/index.tsx
```
Record the current props. They must not change; `index.tsx` is not being edited. From `index.tsx:969-971` the sheet receives `videoId`, `title`, and `url`.

- [ ] **Step 2: Write the failing test**

Create `__tests__/player/VideoShareSheet.test.tsx`:

```tsx
// __tests__/player/VideoShareSheet.test.tsx
import React from "react";
import { Share } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { VideoShareSheet } from "../../components/VideoPlayer/modals/VideoShareSheet";
import { forVideo } from "../../services/shareLinkService";

describe("VideoShareSheet", () => {
  let shareSpy: jest.SpyInstance;

  beforeEach(() => {
    shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it("shares the app deep link, not the raw media url", async () => {
    render(
      <VideoShareSheet
        videoId="v1"
        title="Gayatri Yagya"
        url="https://cdn.test/secret.m3u8"
        visible
        onClose={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByTestId("share-sheet-share"));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const payload = shareSpy.mock.calls[0][0] as { message?: string; url?: string };
    const shared = `${payload.message ?? ""} ${payload.url ?? ""}`;
    expect(shared).toContain(forVideo("v1"));
    expect(shared).not.toContain("secret.m3u8");
  });

  it("includes the title in the shared message", async () => {
    render(
      <VideoShareSheet videoId="v1" title="Gayatri Yagya" url="https://cdn.test/a.m3u8" visible onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId("share-sheet-share"));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const payload = shareSpy.mock.calls[0][0] as { message?: string };
    expect(String(payload.message)).toContain("Gayatri Yagya");
  });

  it("closes after sharing", async () => {
    const onClose = jest.fn();
    render(
      <VideoShareSheet videoId="v1" title="T" url="https://cdn.test/a.m3u8" visible onClose={onClose} />,
    );
    fireEvent.press(screen.getByTestId("share-sheet-share"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("does not crash when the user dismisses the system sheet", async () => {
    shareSpy.mockResolvedValue({ action: "dismissedAction" } as never);
    render(
      <VideoShareSheet videoId="v1" title="T" url="https://cdn.test/a.m3u8" visible onClose={jest.fn()} />,
    );
    expect(() => fireEvent.press(screen.getByTestId("share-sheet-share"))).not.toThrow();
  });

  it("does not crash when the system sheet rejects", async () => {
    shareSpy.mockRejectedValue(new Error("no share provider"));
    render(
      <VideoShareSheet videoId="v1" title="T" url="https://cdn.test/a.m3u8" visible onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId("share-sheet-share"));
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
  });

  it("renders nothing when not visible", () => {
    render(
      <VideoShareSheet videoId="v1" title="T" url="https://cdn.test/a.m3u8" visible={false} onClose={jest.fn()} />,
    );
    expect(screen.queryByTestId("share-sheet-share")).toBeNull();
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=VideoShareSheet
```

- [ ] **Step 4: Replace the sheet's body**

Keep the props interface and the modal shell. Replace the in-app share targets with one pressable carrying `testID="share-sheet-share"` that calls:

```ts
await Share.share({
  message: `${title} — ${forVideo(videoId)}`,
  url: forVideo(videoId),
});
```

Wrap the call in `try/catch`, log a rejection through `Logger.warn`, and call `onClose()` in a `finally`.

**Never share `props.url`.** That is the media URL and may carry a signed token. The deep link is what a recipient should receive, and the first test asserts exactly that.

- [ ] **Step 5: Verify**

Run:
```bash
npm test -- --testPathPattern="VideoShareSheet|VideoPlayer"
npx tsc --noEmit 2>&1 | grep -c "VideoShareSheet"
```
Expected: all pass, `0` type errors.

- [ ] **Step 6: Commit**

```bash
git add components/VideoPlayer/modals/VideoShareSheet.tsx __tests__/player/VideoShareSheet.test.tsx
git commit -m "feat(player): share the app deep link through the system sheet

The sheet offered in-app share targets that led nowhere. It now hands the
operating system a deep link built by shareLinkService. The raw media URL is
never shared, since it may carry a signed token.

Protected-module change per docs/engineering/video-player.md.

Verified: npm test -- --testPathPattern=VideoShareSheet => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

- [ ] `grep -rn "components/VideoPlayer" app components --include=*.tsx | grep -v VideoPlaybackContainer` returns nothing.
- [ ] Share produces a deep link that reopens the app at the shared video, and never exposes the media URL.
- [ ] `contexts/VideoPlayerContext.tsx` and `services/videoService.ts` are deleted.
- [ ] The video screen has zero type errors and renders loading, not-found, invalid-source, offline, and ready states.
- [ ] An unknown id shows not-found and never mounts the player.
- [ ] The `?url=` parameter no longer reaches the player in a production build.
- [ ] `npm test` passes.
- [ ] Manual device check: play, next, previous, autoplay, fullscreen, and back all work.
