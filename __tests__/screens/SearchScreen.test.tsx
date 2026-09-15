// __tests__/screens/SearchScreen.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SearchScreen from "../../app/search";
import * as searchHook from "../../hooks/useSearch";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  Stack: { Screen: () => null },
}));

const mockSetQueue = jest.fn();
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({ setQueue: mockSetQueue }),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../hooks/useSearch");
const mocked = searchHook as jest.Mocked<typeof searchHook>;

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

const mockSetQuery = jest.fn();
const mockCommit = jest.fn();
const mockClearRecent = jest.fn();

function mockState(overrides: Record<string, unknown>) {
  mocked.useSearch.mockReturnValue({
    status: "idle",
    data: null,
    error: null,
    retry: jest.fn(),
    query: "",
    setQuery: mockSetQuery,
    commit: mockCommit,
    recent: [],
    clearRecent: mockClearRecent,
    ...overrides,
  } as ReturnType<typeof searchHook.useSearch>);
}

describe("SearchScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows recent searches when idle", () => {
    mockState({ recent: ["yagna", "gayatri"] });
    render(<SearchScreen />);
    expect(screen.getByText("yagna")).toBeTruthy();
    expect(screen.getByText("gayatri")).toBeTruthy();
  });

  it("forwards typing to the hook", () => {
    mockState({});
    render(<SearchScreen />);
    fireEvent.changeText(screen.getByTestId("search-input"), "yag");
    expect(mockSetQuery).toHaveBeenCalledWith("yag");
  });

  it("commits on submit", () => {
    mockState({ query: "yagna" });
    render(<SearchScreen />);
    fireEvent(screen.getByTestId("search-input"), "submitEditing");
    expect(mockCommit).toHaveBeenCalled();
  });

  it("re-runs a recent query when tapped", () => {
    mockState({ recent: ["yagna"] });
    render(<SearchScreen />);
    fireEvent.press(screen.getByTestId("recent-yagna"));
    expect(mockSetQuery).toHaveBeenCalledWith("yagna");
  });

  it("clears recent searches", () => {
    mockState({ recent: ["yagna"] });
    render(<SearchScreen />);
    fireEvent.press(screen.getByTestId("recent-clear"));
    expect(mockClearRecent).toHaveBeenCalled();
  });

  it("lists results", () => {
    mockState({ status: "success", data: [video("a")], query: "yagna" });
    render(<SearchScreen />);
    expect(screen.getByText("Video a")).toBeTruthy();
  });

  it("sets the queue from results before opening a video", () => {
    mockState({ status: "success", data: [video("a")], query: "yagna" });
    render(<SearchScreen />);
    fireEvent.press(screen.getByTestId("search-result-a"));
    expect(mockSetQueue).toHaveBeenCalledWith([video("a")], "a");
    expect(mockPush).toHaveBeenCalledWith("/video/a");
  });

  it("shows an empty state naming the query", () => {
    mockState({ status: "empty", data: [], query: "zzzz" });
    render(<SearchScreen />);
    expect(screen.getByTestId("search-state")).toBeTruthy();
  });

  it("shows an offline state with retry", () => {
    const retry = jest.fn();
    mockState({ status: "offline", data: null, error: makeError("network"), retry, query: "y" });
    render(<SearchScreen />);
    fireEvent.press(screen.getByTestId("search-state-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
