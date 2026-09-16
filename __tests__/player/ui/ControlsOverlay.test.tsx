// __tests__/player/ui/ControlsOverlay.test.tsx
import { render, screen } from "@testing-library/react-native";
import { makeMutable } from "react-native-reanimated";
import { ControlsOverlay, type ControlsOverlayProps } from "../../../components/VideoPlayer/ui/ControlsOverlay";
import { liveSnapshot, playingSnapshot, errorSnapshot } from "../fakes/snapshots";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

function props(overrides: Partial<ControlsOverlayProps> = {}): ControlsOverlayProps {
  return {
    snapshot: playingSnapshot(), commands: commands(), visible: true, opacity: makeMutable(1), layoutMode: "inline",
    insets: { top: 0, bottom: 0, left: 0, right: 0 }, hasNext: true, hasPrevious: false, isAutoplayNextEnabled: true,
    pipSupported: true, haptics: { light: jest.fn() },
    onNext: jest.fn(), onPrevious: jest.fn(), onToggleAutoplayNext: jest.fn(), onToggleFullscreen: jest.fn(), onToggleMinimize: jest.fn(),
    onOpenSettings: jest.fn(), onPip: jest.fn(), onSeekStart: jest.fn(), onSeekPreview: jest.fn(), onSeekCommit: jest.fn(), onSeekCancel: jest.fn(),
    testID: "overlay", ...overrides,
  };
}

describe("ControlsOverlay", () => {
  it("renders the three rows for a playing VOD", () => {
    render(<ControlsOverlay {...props()} />);
    expect(screen.getByLabelText("Minimize player")).toBeTruthy();
    expect(screen.getByLabelText("Autoplay on")).toBeTruthy();
    expect(screen.getByLabelText("Picture in picture")).toBeTruthy();
    expect(screen.getByLabelText("Settings")).toBeTruthy();
    expect(screen.getByLabelText("Previous video")).toBeTruthy();
    expect(screen.getByLabelText("Pause")).toBeTruthy();
    expect(screen.getByLabelText("Next video")).toBeTruthy();
    expect(screen.getByLabelText("Mute")).toBeTruthy();
    expect(screen.getByLabelText("Fullscreen")).toBeTruthy();
    expect(screen.getByLabelText("Seek")).toBeTruthy();
    expect(screen.queryByLabelText("Live")).toBeNull();
  });
  it("live: badge shown, progress hidden without a window, minimize hidden in fullscreen", () => {
    render(<ControlsOverlay {...props({ snapshot: liveSnapshot(0), layoutMode: "fullscreen" })} />);
    expect(screen.getByLabelText("Live")).toBeTruthy();
    expect(screen.queryByLabelText("Seek")).toBeNull();
    expect(screen.queryByLabelText("Minimize player")).toBeNull();
    expect(screen.getByLabelText("Exit fullscreen")).toBeTruthy();
  });
  it("hidden overlay blocks pointer events; visible overlay is box-none", () => {
    const { rerender } = render(<ControlsOverlay {...props({ visible: false })} />);
    expect(screen.getByTestId("overlay").props.pointerEvents).toBe("none");
    rerender(<ControlsOverlay {...props({ visible: true })} />);
    expect(screen.getByTestId("overlay").props.pointerEvents).toBe("box-none");
  });
  it("centre slot is empty in error (ErrorCard owns it)", () => {
    render(<ControlsOverlay {...props({ snapshot: errorSnapshot() })} />);
    expect(screen.queryByLabelText("Pause")).toBeNull();
    expect(screen.queryByLabelText("Play")).toBeNull();
  });
});
