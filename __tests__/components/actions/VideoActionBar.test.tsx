// __tests__/components/actions/VideoActionBar.test.tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { VideoActionState } from "../../../services/videoActions/VideoActionsRepository";

// VideoActionBar reads useSafeAreaInsets() for bottom padding; without a
// provider (real or mocked) under Jest this throws before the buttons ever
// render. Provide fixed insets so the render proceeds. Same pattern as
// VideoPlayer.render.test.tsx.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

// VideoActionBar renders DownloadSheet/ThanksSheet, which read from
// VideoActionsProvider's default deps (real downloadService/
// localVideoActionsRepository singletons), pulling in native AsyncStorage.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// VideoActionBar renders SaveSheet, which reads useSaved() from SavedContext.
jest.mock("../../../contexts/SavedContext", () => ({
  useSaved: () => ({ savedIds: [], hydrated: true, isSaved: () => false, isLiked: () => false, toggleSave: jest.fn(), toggleLike: jest.fn() }),
}));

const mockActions = {
  state: { videoId: "v1", liked: false, disliked: false, reported: false, notInterested: false, counts: null, updatedAt: "t" } as VideoActionState,
  status: "ready" as const,
  error: null as { code: string; message: string } | null,
  pending: new Set<string>(),
  like: jest.fn(),
  dislike: jest.fn(),
  report: jest.fn(),
  notInterested: jest.fn(),
  hideChannel: jest.fn(),
  createClip: jest.fn(async () => null),
  retry: jest.fn(),
};

jest.mock("../../../components/Video/actions/useVideoActions", () => ({
  useVideoActions: () => mockActions,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const configModule = require("../../../constants/config");

import { VideoActionBar } from "../../../components/Video/actions/VideoActionBar";

const baseProps = {
  videoId: "v1",
  videoTitle: "Gayatri Yagya",
  videoUrl: "https://example.test/video.mp4",
  channelId: "c1",
  sourceKind: "mp4" as const,
};

describe("VideoActionBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActions.state = { videoId: "v1", liked: false, disliked: false, reported: false, notInterested: false, counts: null, updatedAt: "t" };
    mockActions.error = null;
    mockActions.pending = new Set();
  });

  it("shows the actions that work", () => {
    render(<VideoActionBar {...baseProps} />);
    expect(screen.getByLabelText(/^like button/i)).toBeTruthy();
    expect(screen.getByLabelText(/^dislike button/i)).toBeTruthy();
    expect(screen.getByLabelText(/^clip button/i)).toBeTruthy();
    expect(screen.getByLabelText(/share/i)).toBeTruthy();
    expect(screen.getByLabelText(/save/i)).toBeTruthy();
  });

  it("hides download and thanks, which have no verified implementation or are pending a human decision", () => {
    render(<VideoActionBar {...baseProps} />);
    expect(screen.queryByLabelText(/download/i)).toBeNull();
    expect(screen.queryByLabelText(/thanks/i)).toBeNull();
  });

  it("pressing Like calls useVideoActions().like", () => {
    render(<VideoActionBar {...baseProps} />);
    fireEvent.press(screen.getByLabelText(/^like button/i));
    expect(mockActions.like).toHaveBeenCalled();
  });

  it("Thanks button is present only when PLAYER_FEATURE_FLAGS.thanks is on", () => {
    const original = configModule.PLAYER_FEATURE_FLAGS.thanks;
    configModule.PLAYER_FEATURE_FLAGS.thanks = true;
    render(<VideoActionBar {...baseProps} />);
    expect(screen.getByLabelText(/thanks/i)).toBeTruthy();
    configModule.PLAYER_FEATURE_FLAGS.thanks = original;
  });

  it("Download stays hidden for an HLS source even when the flag is on", () => {
    const original = configModule.PLAYER_FEATURE_FLAGS.download;
    configModule.PLAYER_FEATURE_FLAGS.download = true;
    render(<VideoActionBar {...baseProps} sourceKind="hls" />);
    expect(screen.queryByLabelText(/download/i)).toBeNull();
    configModule.PLAYER_FEATURE_FLAGS.download = original;
  });

  it("shows counts only when actions.state.counts is not null", () => {
    mockActions.state = { ...mockActions.state, counts: { likes: 42, dislikes: 1 } };
    render(<VideoActionBar {...baseProps} />);
    expect(screen.getByText(/42/)).toBeTruthy();
  });

  it("shows the action error message", () => {
    mockActions.error = { code: "storage", message: "Could not save your changes on this device." };
    render(<VideoActionBar {...baseProps} />);
    expect(screen.getByText("Could not save your changes on this device.")).toBeTruthy();
  });
});
