// __tests__/player/gestures/useControlsVisibility.test.tsx
// Rules V1-V9: docs/player/06-ui-and-gestures-spec.md §3
import { act, renderHook } from "@testing-library/react-native";
import { useControlsVisibility } from "../../../components/VideoPlayer/gestures/useControlsVisibility";
import { AUTO_HIDE_MS, INITIAL_VISIBLE_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackStatus } from "../../../components/VideoPlayer/engine/types";

type Input = { status: PlaybackStatus; isSheetOpen: boolean; isMinimized: boolean };
const playing: Input = { status: "playing", isSheetOpen: false, isMinimized: false };

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("useControlsVisibility", () => {
  it("V1: visible on mount, hides after INITIAL_VISIBLE_MS while playing", () => {
    const { result } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS - 1));
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
    expect(result.current.opacity.value).toBe(0);
  });

  it("V2: interaction shows and restarts the AUTO_HIDE_MS timer", () => {
    const { result } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS));
    expect(result.current.visible).toBe(false);
    act(() => result.current.onInteraction());
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(AUTO_HIDE_MS - 1));
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it("V3/V4: stays visible while paused, buffering, ended, error, loading, ready", () => {
    for (const status of ["paused", "buffering", "ended", "error", "loading", "ready"] as const) {
      const { result, unmount } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: { ...playing, status } });
      act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS + AUTO_HIDE_MS));
      expect(result.current.visible).toBe(true);
      unmount();
    }
  });

  it("V4/V5: pause shows and cancels; resuming schedules the hide again", () => {
    const { result, rerender } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS));
    expect(result.current.visible).toBe(false);
    rerender({ ...playing, status: "paused" });
    expect(result.current.visible).toBe(true);
    rerender(playing);
    act(() => jest.advanceTimersByTime(AUTO_HIDE_MS));
    expect(result.current.visible).toBe(false);
  });

  it("V6: an open sheet forces visible; closing restarts the timer", () => {
    const { result, rerender } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    rerender({ ...playing, isSheetOpen: true });
    act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS + AUTO_HIDE_MS));
    expect(result.current.visible).toBe(true);
    rerender(playing);
    act(() => jest.advanceTimersByTime(AUTO_HIDE_MS));
    expect(result.current.visible).toBe(false);
  });

  it("V7/V8: minimized clears timers; unmount leaves no timers", () => {
    const { rerender, unmount } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    rerender({ ...playing, isMinimized: true });
    expect(jest.getTimerCount()).toBe(0);
    rerender(playing);
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
