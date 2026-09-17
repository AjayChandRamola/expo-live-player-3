// __tests__/components/VideoPlaybackContainer.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

// VideoActionsProvider's default deps are built from the real
// downloadService/localVideoActionsRepository singletons at module scope,
// which pull in native AsyncStorage even though this test always overrides
// `downloads` via deps.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

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
const mockTrack = jest.fn();
jest.mock("../../services/analytics", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

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
  mockTrack.mockClear();
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
    expect(mockTrack).toHaveBeenCalledWith("video_start", { videoId: "v1", kind: "mp4", local: true });
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
    await waitFor(() => expect(mockTrack).toHaveBeenCalledWith("video_start", { videoId: "v1", kind: "mp4", local: false }));
    const last = playerProps[playerProps.length - 1] as { onFinished: () => void };
    last.onFinished();
    expect(mockTrack).toHaveBeenCalledWith("video_finish", { videoId: "v1" });
    expect(p.onFinished).toHaveBeenCalledTimes(1);
  });

  it("throttles video_progress analytics to once per minute", async () => {
    jest.useFakeTimers();
    renderContainer();
    await waitFor(() => expect(playerProps.length).toBeGreaterThan(0));
    const last = playerProps[playerProps.length - 1] as { onPositionChange: (p: number, d: number) => void };
    last.onPositionChange(5_000, 100_000);
    last.onPositionChange(10_000, 100_000);
    expect(mockTrack.mock.calls.filter((c) => c[0] === "video_progress")).toHaveLength(1);
    jest.advanceTimersByTime(60_000);
    last.onPositionChange(70_000, 100_000);
    expect(mockTrack.mock.calls.filter((c) => c[0] === "video_progress")).toHaveLength(2);
    jest.useRealTimers();
  });
});
