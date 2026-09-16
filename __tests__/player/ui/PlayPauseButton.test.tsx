// __tests__/player/ui/PlayPauseButton.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PlayPauseButton } from "../../../components/VideoPlayer/ui/controls/PlayPauseButton";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

function commands(): PlaybackCommands {
  return {
    play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
    setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
    retry: jest.fn(), replay: jest.fn(),
  };
}

describe("PlayPauseButton", () => {
  it("playing → Pause label, calls togglePlay", () => {
    const c = commands();
    render(<PlayPauseButton status="playing" commands={c} testID="pp" />);
    fireEvent.press(screen.getByLabelText("Pause"));
    expect(c.togglePlay).toHaveBeenCalledTimes(1);
  });
  it("paused and ready → Play label", () => {
    const c = commands();
    render(<PlayPauseButton status="paused" commands={c} />);
    expect(screen.getByLabelText("Play")).toBeTruthy();
  });
  it("ended → Replay label, calls replay", () => {
    const c = commands();
    render(<PlayPauseButton status="ended" commands={c} />);
    fireEvent.press(screen.getByLabelText("Replay"));
    expect(c.replay).toHaveBeenCalledTimes(1);
    expect(c.togglePlay).not.toHaveBeenCalled();
  });
  it.each(["loading", "buffering", "error", "idle"] as const)("%s → hidden", (status) => {
    render(<PlayPauseButton status={status} commands={commands()} testID="pp" />);
    expect(screen.queryByTestId("pp")).toBeNull();
  });
  it("twenty presses forward twenty commands", () => {
    const c = commands();
    render(<PlayPauseButton status="playing" commands={c} />);
    const btn = screen.getByLabelText("Pause");
    for (let i = 0; i < 20; i += 1) fireEvent.press(btn);
    expect(c.togglePlay).toHaveBeenCalledTimes(20);
  });
});
