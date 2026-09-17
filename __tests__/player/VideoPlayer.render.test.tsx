// __tests__/player/VideoPlayer.render.test.tsx
// Characterization tests for the existing VideoPlayer.
// These lock in current behavior so stabilization cannot change it.
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

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

// The relocated VideoActionBar (Increment 5) reads its default deps from
// VideoActionsProvider, which eagerly imports the real downloadService/
// localVideoActionsRepository singletons at module scope, pulling in the
// native AsyncStorage module.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// VideoSaveSheet (a VideoPlayer modal) now reads useSaved() from
// SavedContext instead of the removed playlist service.
jest.mock("../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds: [],
    hydrated: true,
    isSaved: () => false,
    isLiked: () => false,
    toggleSave: jest.fn(),
    toggleLike: jest.fn(),
  }),
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

// Parity rows from docs/player/10-migration-and-swap.md section 3.
// These lock the OLD player's visible behaviour so the NEW player can be
// checked against it in Increment 4. Do not weaken a row to make it pass;
// if a row does not hold today, record the actual behaviour in the report.
describe("VideoPlayer parity characterization (old player)", () => {
  const baseProps = {
    sourceUrl: MP4,
    videoId: "v1",
    videoTitle: "Gayatri Yagya",
    videoUrl: MP4,
    channelId: "c1",
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("C3: mounts one VideoView with native controls and native fullscreen disabled", () => {
    render(<VideoPlayer {...baseProps} />);
    const views = screen.getAllByTestId("expo-video-view");
    expect(views).toHaveLength(1);
    expect(views[0].props.nativeControls).toBe(false);
    expect(views[0].props.allowsFullscreen).toBe(false);
  });

  it("C4: calls play() on mount when autoplay is default (true)", () => {
    const { useVideoPlayer } = jest.requireMock("expo-video") as {
      useVideoPlayer: jest.Mock;
    };
    render(<VideoPlayer {...baseProps} />);
    const player = useVideoPlayer.mock.results[0]?.value as { play: jest.Mock };
    expect(player.play).toHaveBeenCalled();
  });

  it("C4: does not call play() on mount when autoplay is false", () => {
    const { useVideoPlayer } = jest.requireMock("expo-video") as {
      useVideoPlayer: jest.Mock;
    };
    render(<VideoPlayer {...baseProps} autoplay={false} />);
    const player = useVideoPlayer.mock.results[0]?.value as { play: jest.Mock };
    expect(player.play).not.toHaveBeenCalled();
  });

  it("C5/C6: next and previous buttons call their handlers when enabled", () => {
    const onNext = jest.fn();
    const onPrev = jest.fn();
    render(
      <VideoPlayer
        {...baseProps}
        hasNextVideo
        hasPreviousVideo
        onNavigateToNext={onNext}
        onNavigateToPrevious={onPrev}
      />,
    );
    fireEvent.press(screen.getByLabelText(/next video/i));
    fireEvent.press(screen.getByLabelText(/previous video/i));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("C5: next and previous buttons are disabled when no neighbour exists", () => {
    const onNext = jest.fn();
    render(
      <VideoPlayer
        {...baseProps}
        hasNextVideo={false}
        hasPreviousVideo={false}
        onNavigateToNext={onNext}
      />,
    );
    fireEvent.press(screen.getByLabelText(/next video/i));
    expect(onNext).not.toHaveBeenCalled();
  });

  it("C7: minimize button calls onToggleMinimize", () => {
    const onToggleMinimize = jest.fn();
    render(<VideoPlayer {...baseProps} onToggleMinimize={onToggleMinimize} />);
    fireEvent.press(screen.getByLabelText(/minimize/i));
    expect(onToggleMinimize).toHaveBeenCalledTimes(1);
  });

  it("C9: fullscreen button toggles and reports onFullscreenChange(true)", async () => {
    const onFullscreenChange = jest.fn();
    render(<VideoPlayer {...baseProps} onFullscreenChange={onFullscreenChange} />);
    // Initial notification with false happens on mount.
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
    fireEvent.press(screen.getByLabelText(/fullscreen/i));
    await waitFor(() => expect(onFullscreenChange).toHaveBeenLastCalledWith(true));
  });

  it("C14: dislike, download and clip buttons are hidden by feature flags", () => {
    render(<VideoPlayer {...baseProps} />);
    expect(screen.queryByLabelText(/dislike/i)).toBeNull();
    expect(screen.queryByLabelText(/download/i)).toBeNull();
    expect(screen.queryByLabelText(/clip/i)).toBeNull();
  });

  it("C10/C11: progress bar and action bar are absent when videoId is missing", () => {
    render(<VideoPlayer sourceUrl={MP4} />);
    expect(screen.queryByLabelText(/like/i)).toBeNull();
    expect(screen.queryByLabelText(/share/i)).toBeNull();
  });
});
