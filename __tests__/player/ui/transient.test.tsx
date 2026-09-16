// __tests__/player/ui/transient.test.tsx
import { act, render, screen } from "@testing-library/react-native";
import { PixelRatio } from "react-native";
import { CaptionsView } from "../../../components/VideoPlayer/ui/CaptionsView";
import { BufferingIndicator } from "../../../components/VideoPlayer/ui/BufferingIndicator";
import { Toast } from "../../../components/VideoPlayer/ui/Toast";
import { SwipeIndicator } from "../../../components/VideoPlayer/ui/SwipeIndicator";
import { BUFFERING_INDICATOR_DELAY_MS, CAPTION_FONT_SIZE } from "../../../components/VideoPlayer/constants";

describe("CaptionsView", () => {
  const cues = [{ start: 0, end: 2, text: "Om" }, { start: 5, end: 6, text: "Shanti" }];
  it("shows the active cue and nothing in a gap", () => {
    const { rerender } = render(<CaptionsView captions={cues} positionMs={1_000} testID="cc" />);
    expect(screen.getByText("Om")).toBeTruthy();
    rerender(<CaptionsView captions={cues} positionMs={3_000} testID="cc" />);
    expect(screen.queryByTestId("cc")).toBeNull();
  });
  it("scales the font with the accessibility font scale", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.5);
    render(<CaptionsView captions={cues} positionMs={1_000} />);
    expect(screen.getByText("Om").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: CAPTION_FONT_SIZE * 1.5 })]));
  });
});

describe("BufferingIndicator", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("appears after the delay in buffering and disappears immediately when playing", () => {
    const { rerender } = render(<BufferingIndicator status="buffering" testID="spin" />);
    expect(screen.queryByTestId("spin")).toBeNull();
    act(() => jest.advanceTimersByTime(BUFFERING_INDICATOR_DELAY_MS));
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    rerender(<BufferingIndicator status="playing" testID="spin" />);
    expect(screen.queryByTestId("spin")).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
  it("a stall shorter than the delay never flashes", () => {
    const { rerender } = render(<BufferingIndicator status="loading" testID="spin" />);
    act(() => jest.advanceTimersByTime(BUFFERING_INDICATOR_DELAY_MS - 1));
    rerender(<BufferingIndicator status="ready" testID="spin" />);
    act(() => jest.advanceTimersByTime(10));
    expect(screen.queryByTestId("spin")).toBeNull();
  });
  it("unmount clears the timer", () => {
    const { unmount } = render(<BufferingIndicator status="loading" />);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("Toast", () => {
  it("renders the message with a live region and nothing when null", () => {
    const { rerender } = render(<Toast message="Autoplay is on" testID="toast" />);
    expect(screen.getByText("Autoplay is on")).toBeTruthy();
    expect(screen.getByTestId("toast").props.accessibilityLiveRegion).toBe("polite");
    rerender(<Toast message={null} testID="toast" />);
    expect(screen.queryByTestId("toast")).toBeNull();
  });
});

describe("SwipeIndicator", () => {
  it("renders the level as a fill height and the right icon; hidden when null", () => {
    const { rerender } = render(<SwipeIndicator level={{ kind: "volume", level: 0.25 }} testID="swipe" />);
    expect(screen.getByTestId("swipe-fill").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: "25%" })]));
    expect(screen.getByLabelText("Volume 25%")).toBeTruthy();
    rerender(<SwipeIndicator level={null} testID="swipe" />);
    expect(screen.queryByTestId("swipe")).toBeNull();
  });
});
