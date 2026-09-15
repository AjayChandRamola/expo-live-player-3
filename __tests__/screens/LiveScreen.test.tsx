// __tests__/screens/LiveScreen.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import LiveScreen from "../../app/(tabs)/live";
import * as liveStatus from "../../hooks/useLiveStatus";
import * as liveService from "../../services/liveService";
import { makeError } from "../../services/appError";
import type { LiveStatus } from "../../types/domain";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));

jest.mock("../../components/Video/VideoPlaybackContainer", () => ({
  VideoPlaybackContainer: () => {
    const React = require("react");
    return React.createElement("View", { testID: "live-player" });
  },
}));
jest.mock("../../components/Live/LiveEmbedView", () => ({
  LiveEmbedView: () => {
    const React = require("react");
    return React.createElement("View", { testID: "live-embed" });
  },
}));

jest.mock("../../hooks/useLiveStatus");
jest.mock("../../services/liveService");

const mockedStatus = liveStatus as jest.Mocked<typeof liveStatus>;
const mockedService = liveService as jest.Mocked<typeof liveService>;

function status(overrides: Partial<LiveStatus>): LiveStatus {
  return {
    state: "none",
    checkedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as LiveStatus;
}

const hlsSession = {
  id: "s1",
  title: "Gayatri Yagya",
  thumbnailUrl: "https://cdn.test/t.jpg",
  startsAt: "2026-01-01T00:00:00Z",
  source: { kind: "hls" as const, url: "https://cdn.test/live.m3u8" },
};

function mockHook(overrides: Record<string, unknown>) {
  mockedStatus.useLiveStatus.mockReturnValue({
    status: "success",
    data: status({}),
    error: null,
    retry: jest.fn(),
    ...overrides,
  } as ReturnType<typeof liveStatus.useLiveStatus>);
}

describe("LiveScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.getRecentSessions.mockResolvedValue([]);
  });

  it("plays an HLS live stream through the shared container", () => {
    mockHook({ data: status({ state: "live", session: hlsSession }) });
    render(<LiveScreen />);
    expect(screen.getByTestId("live-player")).toBeTruthy();
    expect(screen.queryByTestId("live-embed")).toBeNull();
  });

  it("uses the embed view for a YouTube source", () => {
    mockHook({
      data: status({
        state: "live",
        session: {
          ...hlsSession,
          source: { kind: "youtube", url: "https://www.youtube.com/watch?v=abc12345678" },
        },
      }),
    });
    render(<LiveScreen />);
    expect(screen.getByTestId("live-embed")).toBeTruthy();
    expect(screen.queryByTestId("live-player")).toBeNull();
  });

  it("shows a countdown when a session is upcoming", () => {
    mockHook({
      data: status({
        state: "upcoming",
        session: { ...hlsSession, startsAt: new Date(Date.now() + 3_600_000).toISOString() },
      }),
    });
    render(<LiveScreen />);
    expect(screen.getByTestId("live-upcoming")).toBeTruthy();
  });

  it("offers the replay when a session has ended", () => {
    mockHook({
      data: status({ state: "ended", session: { ...hlsSession, replayVideoId: "v9" } }),
    });
    render(<LiveScreen />);
    fireEvent.press(screen.getByTestId("live-replay-button"));
    expect(mockPush).toHaveBeenCalledWith("/video/v9");
  });

  it("says nothing is scheduled when there is no session", () => {
    mockHook({ data: status({ state: "none" }) });
    render(<LiveScreen />);
    expect(screen.getByTestId("live-none")).toBeTruthy();
  });

  it("shows an offline state with retry", () => {
    const retry = jest.fn();
    mockHook({ status: "offline", data: null, error: makeError("network"), retry });
    render(<LiveScreen />);
    fireEvent.press(screen.getByTestId("live-state-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows an error state rather than the player when the source cannot be resolved", () => {
    mockHook({
      data: status({
        state: "live",
        session: { ...hlsSession, source: { kind: "hls", url: "http://insecure.test/a.m3u8" } },
      }),
    });
    render(<LiveScreen />);
    expect(screen.queryByTestId("live-player")).toBeNull();
    expect(screen.getByTestId("live-source-error")).toBeTruthy();
  });
});
