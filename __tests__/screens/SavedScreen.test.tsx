// __tests__/screens/SavedScreen.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SavedScreen from "../../app/(tabs)/saved";
import * as savedVideos from "../../hooks/useSavedVideos";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockToggleSave = jest.fn();
jest.mock("../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds: ["a"],
    hydrated: true,
    isSaved: () => true,
    isLiked: () => false,
    toggleSave: mockToggleSave,
    toggleLike: jest.fn(),
  }),
}));

const mockSetQueue = jest.fn();
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({ setQueue: mockSetQueue }),
}));

jest.mock("../../hooks/useSavedVideos");
const mocked = savedVideos as jest.Mocked<typeof savedVideos>;

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

function mockState(overrides: Record<string, unknown>) {
  mocked.useSavedVideos.mockReturnValue({
    status: "success",
    data: [video("a")],
    error: null,
    retry: jest.fn(),
    missingIds: [],
    ...overrides,
  } as ReturnType<typeof savedVideos.useSavedVideos>);
}

describe("SavedScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists saved videos", () => {
    mockState({});
    render(<SavedScreen />);
    expect(screen.getByText("Video a")).toBeTruthy();
  });

  it("shows an empty state with a hint", () => {
    mockState({ status: "empty", data: [] });
    render(<SavedScreen />);
    expect(screen.getByTestId("saved-empty")).toBeTruthy();
  });

  it("shows an offline state with retry", () => {
    const retry = jest.fn();
    mockState({ status: "offline", data: null, error: makeError("network"), retry });
    render(<SavedScreen />);
    fireEvent.press(screen.getByTestId("saved-state-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("sets the queue from the saved list before opening a video", () => {
    mockState({});
    render(<SavedScreen />);
    fireEvent.press(screen.getByTestId("saved-item-a"));
    expect(mockSetQueue).toHaveBeenCalledWith([video("a")], "a");
    expect(mockPush).toHaveBeenCalledWith("/video/a");
  });

  it("unsaves from the row action", () => {
    mockState({});
    render(<SavedScreen />);
    fireEvent.press(screen.getByTestId("saved-unsave-a"));
    expect(mockToggleSave).toHaveBeenCalledWith("a");
  });

  it("marks entries whose video no longer exists", () => {
    mockState({ missingIds: ["gone"] });
    render(<SavedScreen />);
    expect(screen.getByTestId("saved-missing-notice")).toBeTruthy();
  });
});
