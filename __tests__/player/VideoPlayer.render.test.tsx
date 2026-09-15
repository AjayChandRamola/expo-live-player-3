// __tests__/player/VideoPlayer.render.test.tsx
// Characterization tests for the existing VideoPlayer.
// These lock in current behavior so stabilization cannot change it.
import React from "react";
import { render, screen } from "@testing-library/react-native";

// VideoProgressBar (a VideoPlayer child) uses react-native-gesture-handler,
// whose native `install()` call is unavailable under Jest. Use the library's
// own documented jest setup so gesture handling renders as a no-op instead
// of throwing before the component tree is reached. Must run before
// VideoPlayer (and its children) are imported/required.
import "react-native-gesture-handler/jestSetup";

import VideoPlayer from "../../components/VideoPlayer";

// expo-video drives native playback, which does not exist under Jest.
// This mock gives the component a player object shaped like the real one.
jest.mock("expo-video", () => {
  const React = require("react");
  return {
    useVideoPlayer: jest.fn(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      replace: jest.fn(),
      playing: false,
      muted: false,
      loop: false,
      currentTime: 0,
      duration: 100,
      playbackRate: 1,
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeAllListeners: jest.fn(),
      release: jest.fn(),
    })),
    VideoView: (props: Record<string, unknown>) =>
      React.createElement("VideoView", { testID: "expo-video-view", ...props }),
  };
});

// components/VideoPlayer/index.tsx reads useSafeAreaInsets() before it ever
// reaches the isPlaying temporal-dead-zone line; without a provider (real or
// mocked) the render fails on the safe-area hook instead, masking the bug
// this suite exists to prove. Provide fixed insets so the render proceeds.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: {
    PORTRAIT_UP: "PORTRAIT_UP",
    LANDSCAPE_RIGHT: "LANDSCAPE_RIGHT",
  },
}));

const MP4 = "https://example.test/video.mp4";

describe("VideoPlayer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders without throwing", () => {
    expect(() => render(<VideoPlayer sourceUrl={MP4} />)).not.toThrow();
  });

  it("mounts the expo-video surface", () => {
    render(<VideoPlayer sourceUrl={MP4} />);
    expect(screen.getByTestId("expo-video-view")).toBeTruthy();
  });

  it("accepts the full documented prop surface without a type or runtime error", () => {
    expect(() =>
      render(
        <VideoPlayer
          sourceUrl={MP4}
          autoplay={false}
          hasPreviousVideo
          hasNextVideo
          onNavigateToPrevious={jest.fn()}
          onNavigateToNext={jest.fn()}
          isMinimized={false}
          onToggleMinimize={jest.fn()}
          onFullscreenChange={jest.fn()}
          isAutoplayEnabled
          onVideoFinished={jest.fn()}
          videoId="v1"
          videoTitle="Gayatri Yagya"
          videoUrl={MP4}
          channelId="c1"
        />,
      ),
    ).not.toThrow();
  });

  it("renders an HLS source the same way as MP4", () => {
    expect(() =>
      render(<VideoPlayer sourceUrl="https://example.test/stream.m3u8" videoId="v2" />),
    ).not.toThrow();
  });
});
