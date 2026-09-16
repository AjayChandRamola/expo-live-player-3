// __tests__/screens/pullToRefresh.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SavedScreen from "../../app/(tabs)/saved";
import HomeScreen from "../../app/(tabs)/index";
import LiveScreen from "../../app/(tabs)/live";
import * as savedVideos from "../../hooks/useSavedVideos";
import * as homeContent from "../../hooks/useHomeContent";
import * as liveStatusHook from "../../hooks/useLiveStatus";
import * as liveService from "../../services/liveService";
import type { Video } from "../../types/domain";
import type { LiveStatus } from "../../types/domain";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));

jest.mock("../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds: ["a"],
    hydrated: true,
    isSaved: () => true,
    isLiked: () => false,
    toggleSave: jest.fn(),
    toggleLike: jest.fn(),
  }),
}));
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({ setQueue: jest.fn() }),
}));

jest.mock("../../hooks/useSavedVideos");
jest.mock("../../hooks/useHomeContent");
jest.mock("../../hooks/useLiveStatus");
jest.mock("../../services/liveService");
jest.mock("../../services/videoService", () => ({
  fetchVideoFeed: jest.fn().mockResolvedValue({ videos: [], hasMore: false }),
  searchVideos: jest.fn().mockResolvedValue({ videos: [], hasMore: false }),
}));
jest.mock("../../components/Video/VideoPlaybackContainer", () => ({
  VideoPlaybackContainer: () => null,
}));
jest.mock("../../components/Live/LiveEmbedView", () => ({
  LiveEmbedView: () => null,
}));

const mockedSaved = savedVideos as jest.Mocked<typeof savedVideos>;
const mockedHome = homeContent as jest.Mocked<typeof homeContent>;
const mockedLiveStatus = liveStatusHook as jest.Mocked<typeof liveStatusHook>;
const mockedLiveService = liveService as jest.Mocked<typeof liveService>;

const video: Video = {
  id: "a",
  title: "Video a",
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 60,
  publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna" },
  isLive: false,
  source: { kind: "mp4", url: "https://cdn.test/a.mp4" },
};

describe("pull to refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLiveService.getRecentSessions.mockResolvedValue([]);
  });

  it("re-runs the hook's retry when the Saved list is pulled", () => {
    const retry = jest.fn();
    mockedSaved.useSavedVideos.mockReturnValue({
      status: "success",
      data: [video],
      error: null,
      retry,
      missingIds: [],
    } as ReturnType<typeof savedVideos.useSavedVideos>);

    render(<SavedScreen />);
    const list = screen.getByTestId("saved-list");
    fireEvent(list, "refresh");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("re-runs the hook's retry when the Home list is pulled", () => {
    const retry = jest.fn();
    mockedHome.useHomeContent.mockReturnValue({
      status: "success",
      data: { featured: null, latest: [video] },
      error: null,
      retry,
      hasMore: false,
      isLoadingMore: false,
      loadMore: jest.fn(),
    } as ReturnType<typeof homeContent.useHomeContent>);
    mockedLiveStatus.useLiveStatus.mockReturnValue({
      status: "success",
      data: null,
      error: null,
      retry: jest.fn(),
    } as ReturnType<typeof liveStatusHook.useLiveStatus>);

    render(<HomeScreen />);
    const list = screen.getByTestId("home-list");
    fireEvent(list, "refresh");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("re-runs the hook's retry when the Live list is pulled", () => {
    const retry = jest.fn();
    const status: LiveStatus = { state: "none", checkedAt: "2026-01-01T00:00:00Z" };
    mockedLiveStatus.useLiveStatus.mockReturnValue({
      status: "success",
      data: status,
      error: null,
      retry,
    } as ReturnType<typeof liveStatusHook.useLiveStatus>);

    render(<LiveScreen />);
    const list = screen.getByTestId("live-list");
    fireEvent(list, "refresh");
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
