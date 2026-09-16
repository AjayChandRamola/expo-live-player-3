// __tests__/player/VideoPlayer.root.perf.test.tsx
// P4: <= 4 root renders per second of playback with controls hidden.
import React, { Profiler } from "react";
import { act, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { createFakeAdapters } from "./fakes/fakeAdapters";
import type { createFakeEngineHook } from "./fakes/fakeEngineHook";
import { loadingSnapshot, playingSnapshot } from "./fakes/snapshots";

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
import { AUTO_HIDE_MS, INITIAL_VISIBLE_MS } from "../../components/VideoPlayer/constants";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };
function props(overrides: Partial<VideoPlayerProps> = {}): VideoPlayerProps {
  return {
    source: { url: "https://example.test/v.mp4", kind: "mp4", isLive: false, posterUrl: "https://example.test/p.jpg" },
    title: "Gayatri Yagya", hasNext: true, hasPrevious: false, isAutoplayNextEnabled: true, isMinimized: false,
    onNext: jest.fn(), onPrevious: jest.fn(), onFinished: jest.fn(), onToggleMinimize: jest.fn(), onToggleAutoplayNext: jest.fn(),
    onFullscreenChange: jest.fn(), onPositionChange: jest.fn(), onStateChange: jest.fn(), testID: "player", ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEngine.state.setSnapshot(loadingSnapshot());
});

it("renders at most 20 times during 5 seconds of timeUpdate at 250 ms", () => {
  jest.useFakeTimers();
  let renders = 0;
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Profiler id="player" onRender={() => { renders += 1; }}>
        <Player {...props()} />
      </Profiler>
    </SafeAreaProvider>,
  );
  mockEngine.state.setSnapshot(playingSnapshot({ positionMs: 0 }));
  act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS + AUTO_HIDE_MS)); // controls hidden
  renders = 0;
  for (let t = 250; t <= 5_000; t += 250) {
    mockEngine.state.setSnapshot(playingSnapshot({ positionMs: t, bufferedMs: t + 5_000 }));
  }
  expect(renders).toBeLessThanOrEqual(20);
  jest.useRealTimers();
});
