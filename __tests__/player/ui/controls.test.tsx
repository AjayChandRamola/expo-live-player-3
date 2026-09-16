// __tests__/player/ui/controls.test.tsx
// FullscreenButton, MuteButton, AutoplayToggle, PipButton, SettingsButton, MinimizeButton, GoLiveButton, LiveBadge
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FullscreenButton } from "../../../components/VideoPlayer/ui/controls/FullscreenButton";
import { MuteButton } from "../../../components/VideoPlayer/ui/controls/MuteButton";
import { AutoplayToggle } from "../../../components/VideoPlayer/ui/controls/AutoplayToggle";
import { PipButton } from "../../../components/VideoPlayer/ui/controls/PipButton";
import { SettingsButton } from "../../../components/VideoPlayer/ui/controls/SettingsButton";
import { MinimizeButton } from "../../../components/VideoPlayer/ui/controls/MinimizeButton";
import { GoLiveButton } from "../../../components/VideoPlayer/ui/controls/GoLiveButton";
import { LiveBadge } from "../../../components/VideoPlayer/ui/controls/LiveBadge";
import { LIVE_EDGE_TOLERANCE_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

describe("FullscreenButton", () => {
  it("labels follow state and press toggles", () => {
    const onToggle = jest.fn();
    const { rerender } = render(<FullscreenButton isFullscreen={false} onToggle={onToggle} />);
    fireEvent.press(screen.getByLabelText("Fullscreen"));
    rerender(<FullscreenButton isFullscreen onToggle={onToggle} />);
    fireEvent.press(screen.getByLabelText("Exit fullscreen"));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

describe("MuteButton", () => {
  it("Mute when unmuted → setMuted(true); Unmute when muted → setMuted(false)", () => {
    const c = commands();
    const { rerender } = render(<MuteButton muted={false} commands={c} />);
    fireEvent.press(screen.getByLabelText("Mute"));
    expect(c.setMuted).toHaveBeenLastCalledWith(true);
    rerender(<MuteButton muted commands={c} />);
    fireEvent.press(screen.getByLabelText("Unmute"));
    expect(c.setMuted).toHaveBeenLastCalledWith(false);
  });
});

describe("AutoplayToggle", () => {
  it("toggles with the inverse value and reflects selected state", () => {
    const onToggle = jest.fn();
    render(<AutoplayToggle enabled hasNext onToggle={onToggle} testID="ap" />);
    fireEvent.press(screen.getByLabelText("Autoplay on"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("ap").props.accessibilityState.selected).toBe(true);
  });
  it("disabled without a next video", () => {
    const onToggle = jest.fn();
    render(<AutoplayToggle enabled={false} hasNext={false} onToggle={onToggle} testID="ap" />);
    fireEvent.press(screen.getByTestId("ap"));
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Autoplay off")).toBeTruthy();
  });
});

describe("PipButton", () => {
  it("hidden when unsupported; presses when supported", () => {
    const onPress = jest.fn();
    const { rerender } = render(<PipButton supported={false} onPress={onPress} testID="pip" />);
    expect(screen.queryByTestId("pip")).toBeNull();
    rerender(<PipButton supported onPress={onPress} testID="pip" />);
    fireEvent.press(screen.getByLabelText("Picture in picture"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsButton and MinimizeButton", () => {
  it("press callbacks and labels", () => {
    const onSettings = jest.fn();
    const onMinimize = jest.fn();
    render(
      <>
        <SettingsButton onPress={onSettings} />
        <MinimizeButton onPress={onMinimize} />
      </>,
    );
    fireEvent.press(screen.getByLabelText("Settings"));
    fireEvent.press(screen.getByLabelText("Minimize player"));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });
});

describe("GoLiveButton", () => {
  it("hidden for VOD and when at the live edge; visible behind the edge and calls goToLive", () => {
    const c = commands();
    const { rerender } = render(<GoLiveButton isLive={false} liveOffsetMs={null} commands={c} testID="gl" />);
    expect(screen.queryByTestId("gl")).toBeNull();
    rerender(<GoLiveButton isLive liveOffsetMs={LIVE_EDGE_TOLERANCE_MS} commands={c} testID="gl" />);
    expect(screen.queryByTestId("gl")).toBeNull();
    rerender(<GoLiveButton isLive liveOffsetMs={LIVE_EDGE_TOLERANCE_MS + 1} commands={c} testID="gl" />);
    fireEvent.press(screen.getByLabelText("Go live"));
    expect(c.goToLive).toHaveBeenCalledTimes(1);
  });
});

describe("LiveBadge", () => {
  it("renders only when live, with text and label", () => {
    const { rerender } = render(<LiveBadge isLive={false} testID="lb" />);
    expect(screen.queryByTestId("lb")).toBeNull();
    rerender(<LiveBadge isLive testID="lb" />);
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.getByLabelText("Live")).toBeTruthy();
  });
});
