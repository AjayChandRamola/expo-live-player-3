// __tests__/player/ui/MiniPlayer.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MiniPlayer } from "../../../components/VideoPlayer/ui/MiniPlayer";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

describe("MiniPlayer", () => {
  it("tapping the video area restores; close calls onClose; play/pause forwards", () => {
    const onRestore = jest.fn();
    const onClose = jest.fn();
    const c = commands();
    render(<MiniPlayer status="playing" commands={c} onRestore={onRestore} onClose={onClose} testID="mini" />);
    fireEvent.press(screen.getByLabelText("Restore player"));
    expect(onRestore).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText("Close mini player"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText("Pause"));
    expect(c.togglePlay).toHaveBeenCalledTimes(1);
  });
});
