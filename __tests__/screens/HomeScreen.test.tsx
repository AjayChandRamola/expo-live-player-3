// __tests__/screens/HomeScreen.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "../../app/(tabs)/index";
import * as useHomeContentModule from "../../hooks/useHomeContent";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("../../hooks/useHomeContent");
jest.mock("../../components/VideoFeed", () => ({
  VideoFeed: () => null,
}));

const mockSetVideoList = jest.fn();
jest.mock("../../contexts/VideoPlayerContext", () => ({
  useVideoPlayerContext: () => ({ setVideoList: mockSetVideoList, playVideoById: jest.fn() }),
}));

const mockedHook = useHomeContentModule as jest.Mocked<typeof useHomeContentModule>;

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

function mockState(overrides: Partial<ReturnType<typeof useHomeContentModule.useHomeContent>>) {
  mockedHook.useHomeContent.mockReturnValue({
    status: "success",
    data: { featured: null, latest: [] },
    error: null,
    retry: jest.fn(),
    hasMore: false,
    isLoadingMore: false,
    loadMore: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useHomeContentModule.useHomeContent>);
}

describe("HomeScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the branding", () => {
    mockState({});
    render(<HomeScreen />);
    expect(screen.getByText("Yagna Vishnu Bhagwan")).toBeTruthy();
    expect(screen.getByText("Divya Darshan")).toBeTruthy();
  });

  it("shows a loading state while content loads", () => {
    mockState({ status: "loading", data: null });
    render(<HomeScreen />);
    expect(screen.getByTestId("home-state-loading")).toBeTruthy();
  });

  it("shows an error state with a retry action", () => {
    const retry = jest.fn();
    mockState({ status: "error", data: null, error: makeError("unknown"), retry });
    render(<HomeScreen />);
    expect(screen.getByTestId("home-state-retry")).toBeTruthy();
  });

  it("shows an offline state when the feed is unreachable", () => {
    mockState({ status: "offline", data: null, error: makeError("network") });
    render(<HomeScreen />);
    expect(screen.getByText(makeError("network").message)).toBeTruthy();
  });

  it("renders the featured card when one is present", async () => {
    mockState({ data: { featured: video("f1"), latest: [video("a")] } });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId("home-featured")).toBeTruthy());
  });

  it("omits the featured section when there is no featured video", () => {
    mockState({ data: { featured: null, latest: [video("a")] } });
    render(<HomeScreen />);
    expect(screen.queryByTestId("home-featured")).toBeNull();
  });

  it("offers a way to reach search and settings", () => {
    mockState({});
    render(<HomeScreen />);
    expect(screen.getByTestId("home-search-button")).toBeTruthy();
    expect(screen.getByTestId("home-settings-button")).toBeTruthy();
  });
});
