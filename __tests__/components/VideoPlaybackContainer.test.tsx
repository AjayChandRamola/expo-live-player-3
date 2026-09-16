// __tests__/components/VideoPlaybackContainer.test.tsx
import React from "react";
import { render, act } from "@testing-library/react-native";
import { VideoPlaybackContainer } from "../../components/Video/VideoPlaybackContainer";
import type { PlayableSource, Video } from "../../types/domain";

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
