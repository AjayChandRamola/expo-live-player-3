// __tests__/player/VideoActionBar.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";

// VideoActionBar reads useSafeAreaInsets() for bottom padding; without a
// provider (real or mocked) under Jest this throws before the buttons ever
// render. Provide fixed insets so the render proceeds. Same pattern as
// VideoPlayer.render.test.tsx.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

import { VideoActionBar } from "../../components/VideoPlayer/VideoActionBar";

const baseProps = {
  videoId: "v1",
  videoTitle: "Gayatri Yagya",
  videoUrl: "https://example.test/video.mp4",
  channelId: "c1",
  isLiked: false,
  isDisliked: false,
  likeCount: 0,
  dislikeCount: 0,
  isSaved: false,
  onLike: jest.fn(),
  onDislike: jest.fn(),
  onShare: jest.fn(),
  onDownload: jest.fn(),
  onClip: jest.fn(),
  onSave: jest.fn(),
  onMore: jest.fn(),
};

describe("VideoActionBar feature gating", () => {
  it("shows the actions that work", () => {
    render(<VideoActionBar {...baseProps} />);
    expect(screen.getByLabelText(/like/i)).toBeTruthy();
    expect(screen.getByLabelText(/share/i)).toBeTruthy();
    expect(screen.getByLabelText(/save/i)).toBeTruthy();
  });

  it("hides actions that have no verified implementation", () => {
    render(<VideoActionBar {...baseProps} />);
    expect(screen.queryByLabelText(/download/i)).toBeNull();
    expect(screen.queryByLabelText(/clip/i)).toBeNull();
    expect(screen.queryByLabelText(/dislike/i)).toBeNull();
  });
});
