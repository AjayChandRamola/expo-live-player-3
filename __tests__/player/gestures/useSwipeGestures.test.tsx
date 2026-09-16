// __tests__/player/gestures/useSwipeGestures.test.tsx
import React from "react";
import { act, render } from "@testing-library/react-native";
import { View } from "react-native";
import { GestureDetector, State, type PanGesture } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { SWIPE_GESTURE_TEST_ID, useSwipeGestures, type SwipeGesturesInput } from "../../../components/VideoPlayer/gestures/useSwipeGestures";
import { SWIPE_INDICATOR_HIDE_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

function Harness(props: SwipeGesturesInput) {
  const gesture = useSwipeGestures(props);
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: 300, height: 200 }} />
    </GestureDetector>
  );
}
function input(overrides: Partial<SwipeGesturesInput> = {}): SwipeGesturesInput {
  return {
    commands: commands(), enabled: true, layout: { width: 300, height: 200 },
    brightness: { attach: jest.fn(), get: jest.fn().mockResolvedValue(0.5), set: jest.fn().mockResolvedValue({ ok: true }), restore: jest.fn() },
    initialVolume: 0.8, onLevel: jest.fn(), ...overrides,
  };
}
const flush = () => act(async () => Promise.resolve());

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useSwipeGestures", () => {
  it("right half adjusts volume from the initial value by -translationY/height", async () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<PanGesture>(getByGestureTestId(SWIPE_GESTURE_TEST_ID), [
      { state: State.BEGAN, x: 250, y: 100 },
      { state: State.ACTIVE, x: 250, translationY: -40 }, // +0.2
      { state: State.END, x: 250, translationY: -40 },
    ]);
    await flush();
    expect(i.commands.setVolume).toHaveBeenLastCalledWith(1);
    expect(i.onLevel).toHaveBeenCalledWith({ kind: "volume", level: 1 });
    act(() => jest.advanceTimersByTime(SWIPE_INDICATOR_HIDE_MS));
    expect(i.onLevel).toHaveBeenLastCalledWith(null);
  });
  it("left half adjusts brightness from the adapter's current value and clamps", async () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<PanGesture>(getByGestureTestId(SWIPE_GESTURE_TEST_ID), [
      { state: State.BEGAN, x: 50, y: 100 },
      { state: State.ACTIVE, x: 50, translationY: 400 }, // -2.0 → clamp 0
      { state: State.END, x: 50, translationY: 400 },
    ]);
    await flush();
    expect(i.brightness.get).toHaveBeenCalledTimes(1);
    expect(i.brightness.set).toHaveBeenLastCalledWith(0);
    expect(i.onLevel).toHaveBeenCalledWith({ kind: "brightness", level: 0 });
  });
  it("disabled: no commands", async () => {
    const i = input({ enabled: false });
    render(<Harness {...i} />);
    fireGestureHandler<PanGesture>(getByGestureTestId(SWIPE_GESTURE_TEST_ID), [{ state: State.BEGAN, x: 250 }, { state: State.ACTIVE, translationY: -40 }, { state: State.END }]);
    await flush();
    expect(i.commands.setVolume).not.toHaveBeenCalled();
  });
});
