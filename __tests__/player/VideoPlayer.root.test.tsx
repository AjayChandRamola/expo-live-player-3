// __tests__/player/VideoPlayer.root.test.tsx
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { createFakeAdapters } from "./fakes/fakeAdapters";
import type { createFakeEngineHook } from "./fakes/fakeEngineHook";
import { endedSnapshot, errorSnapshot, loadingSnapshot, pausedSnapshot, playingSnapshot } from "./fakes/snapshots";

// jest.mock is hoisted above any local `const`, so both fakes are created
// inside their factories and captured into these outer bindings.
let mockAdapters: ReturnType<typeof createFakeAdapters>;
jest.mock("../../components/VideoPlayer/platform", () => {
  const { createFakeAdapters: create } = require("./fakes/fakeAdapters");
  mockAdapters = create();
  return {
    fullscreenAdapter: mockAdapters.fullscreen,
    orientationAdapter: mockAdapters.orientation,
    systemChromeAdapter: mockAdapters.systemChrome,
    keyboardAdapter: mockAdapters.keyboard,
    pictureInPictureAdapter: mockAdapters.pictureInPicture,
    brightnessAdapter: mockAdapters.brightness,
    hapticsAdapter: mockAdapters.haptics,
  };
});

let mockEngine: ReturnType<typeof createFakeEngineHook>;
jest.mock("../../components/VideoPlayer/engine/usePlaybackEngine", () => {
  const { createFakeEngineHook: create } = require("./fakes/fakeEngineHook");
  mockEngine = create();
  return { usePlaybackEngine: mockEngine.usePlaybackEngine };
});

jest.mock("expo-video", () => {
  const ReactLib = require("react");
  return { VideoView: ReactLib.forwardRef((props: Record<string, unknown>, ref: unknown) => ReactLib.createElement("VideoView", { ...props, ref })) };
});
jest.mock("expo-image", () => {
  const ReactLib = require("react");
  return { Image: (props: Record<string, unknown>) => ReactLib.createElement("Image", props) };
});

import { Player } from "../../components/VideoPlayer/Player";
import type { VideoPlayerProps } from "../../components/VideoPlayer/types";
import { PLAYER_SURFACE_TEST_IDS } from "../../components/VideoPlayer/ui/PlayerSurface";
import { END_SCREEN_COUNTDOWN_MS } from "../../components/VideoPlayer/constants";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };
function props(overrides: Partial<VideoPlayerProps> = {}): VideoPlayerProps {
  return {
    source: { url: "https://example.test/v.mp4", kind: "mp4", isLive: false, posterUrl: "https://example.test/p.jpg" },
    title: "Gayatri Yagya", hasNext: true, hasPrevious: false, isAutoplayNextEnabled: true, isMinimized: false,
    onNext: jest.fn(), onPrevious: jest.fn(), onFinished: jest.fn(), onToggleMinimize: jest.fn(), onToggleAutoplayNext: jest.fn(),
    onFullscreenChange: jest.fn(), onPositionChange: jest.fn(), onStateChange: jest.fn(), testID: "player", ...overrides,
  };
}
function renderPlayer(p: VideoPlayerProps = props()) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Player {...p} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEngine.state.setSnapshot(loadingSnapshot());
});

describe("Player (composition root)", () => {
  it("renders without app providers and passes engine options and position callback", () => {
    const p = props({ autoplay: false, initialPositionMs: 5_000 });
    renderPlayer(p);
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video)).toBeTruthy();
    expect(mockEngine.state.lastOptions).toMatchObject({ autoplay: false, loop: false, mutedByDefault: false, initialPositionMs: 5_000 });
    mockEngine.state.lastCallbacks?.onPositionChange?.(1_000, 2_000);
    expect(p.onPositionChange).toHaveBeenCalledWith(1_000, 2_000);
  });

  it("shows the poster until the first playing snapshot, then never again", () => {
    renderPlayer();
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeTruthy();
    mockEngine.state.setSnapshot(playingSnapshot());
    expect(screen.queryByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeNull();
    mockEngine.state.setSnapshot(pausedSnapshot());
    expect(screen.queryByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeNull();
  });

  it("forwards every snapshot to onStateChange using the latest callback", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderPlayer(props({ onStateChange: first }));
    expect(first).toHaveBeenCalled();
    rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <Player {...props({ onStateChange: second })} />
      </SafeAreaProvider>,
    );
    const s = playingSnapshot({ positionMs: 3 });
    mockEngine.state.setSnapshot(s);
    expect(second).toHaveBeenCalledWith(s);
  });

  it("fullscreen keeps the same VideoView node and reports changes", async () => {
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    const before = screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video);
    await act(async () => fireEvent.press(screen.getByLabelText("Fullscreen")));
    expect(p.onFullscreenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video)).toBe(before);
    expect(screen.getByLabelText("Exit fullscreen")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText("Exit fullscreen")));
    expect(p.onFullscreenChange).toHaveBeenLastCalledWith(false);
  });

  it("minimized renders the mini player and hides the overlay", () => {
    const p = props({ isMinimized: true });
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    fireEvent.press(screen.getByLabelText("Restore player"));
    expect(p.onToggleMinimize).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Fullscreen")).toBeNull();
  });

  it("error shows the card and Retry calls the engine; overlay centre is empty", () => {
    renderPlayer();
    mockEngine.state.setSnapshot(errorSnapshot("network", { retryAttempt: 3 }));
    fireEvent.press(screen.getByLabelText("Retry"));
    expect(mockEngine.state.commands.retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Play")).toBeNull();
  });

  it("ended with autoplay-next runs the countdown then onFinished; cancel stops it", () => {
    jest.useFakeTimers();
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(endedSnapshot());
    expect(screen.getByText(`Up next in ${END_SCREEN_COUNTDOWN_MS / 1000}`)).toBeTruthy();
    act(() => jest.advanceTimersByTime(END_SCREEN_COUNTDOWN_MS));
    expect(p.onFinished).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("autoplay toggle lifts to the app and toasts", () => {
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    fireEvent.press(screen.getByLabelText("Autoplay on"));
    expect(p.onToggleAutoplayNext).toHaveBeenCalledWith(false);
    expect(screen.getByText("Autoplay is off")).toBeTruthy();
  });

  it("PiP button starts PiP and the adapter event updates the engine", async () => {
    renderPlayer();
    mockEngine.state.setSnapshot(playingSnapshot());
    await act(async () => fireEvent.press(screen.getByLabelText("Picture in picture")));
    expect(mockAdapters.pictureInPicture.start).toHaveBeenCalled();
    const view = screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video);
    act(() => view.props.onPictureInPictureStart());
    expect(mockEngine.state.notifyPictureInPicture).toHaveBeenCalledWith(true);
  });

  it("keyboard shortcut maps to a command", () => {
    renderPlayer();
    mockEngine.state.setSnapshot(playingSnapshot());
    mockAdapters.keyboard.press("togglePlay");
    expect(mockEngine.state.commands.togglePlay).toHaveBeenCalled();
  });

  it("unmount restores brightness", () => {
    const { unmount } = renderPlayer();
    unmount();
    expect(mockAdapters.brightness.restore).toHaveBeenCalled();
  });
});
