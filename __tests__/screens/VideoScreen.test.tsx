// __tests__/screens/VideoScreen.test.tsx
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import VideoScreen from "../../app/video/[id]";
import * as detail from "../../hooks/useVideoDetail";
import * as related from "../../hooks/useRelatedVideos";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

const mockPush = jest.fn();
const mockSetParams = jest.fn();
let mockRouteParams: Record<string, string> = { id: "v1" };

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), setParams: mockSetParams }),
  Stack: { Screen: () => null },
}));

const containerProps: Record<string, unknown>[] = [];
jest.mock("../../components/Video/VideoPlaybackContainer", () => ({
  VideoPlaybackContainer: (props: Record<string, unknown>) => {
    containerProps.push(props);
    return null;
  },
}));

const mockPlayNext = jest.fn().mockReturnValue(true);
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
    playNext: mockPlayNext,
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
    mockRouteParams = { id: "v1" };
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
    expect(mockPlayNext).toHaveBeenCalledTimes(1);
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
    mockRouteParams = {};
    mockDetail({ status: "error", data: null, error: makeError("not_found") });
    render(<VideoScreen />);
    expect(containerProps).toHaveLength(0);
  });
});
