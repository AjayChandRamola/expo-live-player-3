// __tests__/player/ui/ProgressBar.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import type { PanGesture, TapGesture } from "react-native-gesture-handler";
import { PROGRESS_BAR_TEST_IDS, ProgressBar, type ProgressBarProps } from "../../../components/VideoPlayer/ui/ProgressBar";

const WIDTH = 200;
function props(overrides: Partial<ProgressBarProps> = {}): ProgressBarProps {
  return {
    positionMs: 25_000, durationMs: 100_000, bufferedMs: 50_000, isLive: false,
    onSeekStart: jest.fn(), onSeekPreview: jest.fn(), onSeekCommit: jest.fn(), onSeekCancel: jest.fn(),
    haptics: { light: jest.fn() }, testID: "bar", ...overrides,
  };
}
function layout() {
  fireEvent(screen.getByTestId(PROGRESS_BAR_TEST_IDS.track), "layout", { nativeEvent: { layout: { width: WIDTH, height: 3, x: 0, y: 0 } } });
}

describe("ProgressBar", () => {
  it("renders played and buffered fractions as widths", () => {
    render(<ProgressBar {...props()} />);
    layout();
    expect(screen.getByTestId("progress-played").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: "25%" })]));
    expect(screen.getByTestId("progress-buffered").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: "50%" })]));
  });

  it("tap seeks to the tapped fraction and fires haptics", () => {
    const p = props();
    render(<ProgressBar {...p} />);
    layout();
    fireGestureHandler<TapGesture>(getByGestureTestId("progress-tap"), [{ x: WIDTH / 2 }]);
    expect(p.onSeekCommit).toHaveBeenCalledWith(50_000);
    expect(p.haptics.light).toHaveBeenCalledTimes(1);
  });

  it("scrub: start, preview, commit", () => {
    const p = props();
    render(<ProgressBar {...p} />);
    layout();
    fireGestureHandler<PanGesture>(getByGestureTestId("progress-pan"), [
      { state: State.BEGAN, x: 20 },
      { state: State.ACTIVE, x: 100 },
      { state: State.ACTIVE, x: 180 },
      { state: State.END, x: 180 },
    ]);
    expect(p.onSeekStart).toHaveBeenCalledTimes(1);
    expect(p.onSeekPreview).toHaveBeenCalledWith(50_000);
    expect(p.onSeekPreview).toHaveBeenLastCalledWith(90_000);
    expect(p.onSeekCommit).toHaveBeenCalledWith(90_000);
  });

  it("scrub cancelled (orientation change) commits nothing", () => {
    const p = props();
    render(<ProgressBar {...p} />);
    layout();
    fireGestureHandler<PanGesture>(getByGestureTestId("progress-pan"), [
      { state: State.BEGAN, x: 20 },
      { state: State.ACTIVE, x: 100 },
      { state: State.CANCELLED, x: 100 },
    ]);
    expect(p.onSeekCommit).not.toHaveBeenCalled();
    expect(p.onSeekCancel).toHaveBeenCalledTimes(1);
  });

  it("renders chapter ticks and tapping one seeks to its start", () => {
    const p = props({ chapters: [{ title: "A", startMs: 0 }, { title: "B", startMs: 40_000 }] });
    render(<ProgressBar {...p} />);
    layout();
    fireEvent.press(screen.getByTestId(PROGRESS_BAR_TEST_IDS.chapter(1)));
    expect(p.onSeekCommit).toHaveBeenCalledWith(40_000);
  });

  it("hidden for live without a window; disabled when disabled", () => {
    const { rerender } = render(<ProgressBar {...props({ isLive: true, durationMs: 0 })} />);
    expect(screen.queryByTestId("bar")).toBeNull();
    const p = props({ disabled: true });
    rerender(<ProgressBar {...p} />);
    layout();
    fireGestureHandler<TapGesture>(getByGestureTestId("progress-tap"), [{ x: 50 }]);
    expect(p.onSeekCommit).not.toHaveBeenCalled();
  });

  it("is adjustable with value text and increment/decrement actions", () => {
    const p = props();
    render(<ProgressBar {...p} />);
    const bar = screen.getByTestId("bar");
    expect(bar.props.accessibilityRole).toBe("adjustable");
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100_000, now: 25_000, text: "0:25 of 1:40" });
    fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(p.onSeekCommit).toHaveBeenLastCalledWith(35_000);
    fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(p.onSeekCommit).toHaveBeenLastCalledWith(15_000);
  });
});
