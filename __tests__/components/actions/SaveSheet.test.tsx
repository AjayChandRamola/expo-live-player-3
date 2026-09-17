// __tests__/player/VideoSaveSheet.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SaveSheet } from "../../../components/Video/actions/sheets/SaveSheet";

const mockToggleSave = jest.fn();
let mockSaved = false;
jest.mock("../../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds: mockSaved ? ["v1"] : [],
    hydrated: true,
    isSaved: () => mockSaved,
    isLiked: () => false,
    toggleSave: mockToggleSave,
    toggleLike: jest.fn(),
  }),
}));

describe("SaveSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaved = false;
  });

  it("offers to save a video that is not saved", () => {
    render(<SaveSheet videoId="v1" visible onClose={jest.fn()} />);
    expect(screen.getByTestId("save-sheet-toggle")).toBeTruthy();
    expect(screen.getByText(/save/i)).toBeTruthy();
  });

  it("reflects a video that is already saved", () => {
    mockSaved = true;
    render(<SaveSheet videoId="v1" visible onClose={jest.fn()} />);
    expect(screen.getByText(/saved/i)).toBeTruthy();
  });

  it("toggles through SavedContext, not a playlist service", () => {
    render(<SaveSheet videoId="v1" visible onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId("save-sheet-toggle"));
    expect(mockToggleSave).toHaveBeenCalledWith("v1");
  });

  it("closes after the user acts", () => {
    const onClose = jest.fn();
    render(<SaveSheet videoId="v1" visible onClose={onClose} />);
    fireEvent.press(screen.getByTestId("save-sheet-toggle"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when not visible", () => {
    render(<SaveSheet videoId="v1" visible={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId("save-sheet-toggle")).toBeNull();
  });

  it("no longer reaches the playlist service", () => {
    const service = require("../../../services/videoActionsService");
    const spy = jest.spyOn(service.videoActionsService, "getPlaylists");
    render(<SaveSheet videoId="v1" visible onClose={jest.fn()} />);
    expect(spy).not.toHaveBeenCalled();
  });
});
