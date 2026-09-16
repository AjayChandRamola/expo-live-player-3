// __tests__/player/gestures/useTapGestures.test.tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import { GestureDetector, State, type LongPressGesture, type TapGesture } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { TAP_GESTURE_TEST_IDS, useTapGestures, type TapGesturesInput } from "../../../components/VideoPlayer/gestures/useTapGestures";
import { SKIP_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

function Harness(props: TapGesturesInput) {
  const gesture = useTapGestures(props);
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: 300, height: 200 }} />
    </GestureDetector>
  );
}

function input(overrides: Partial<TapGesturesInput> = {}): TapGesturesInput {
  return {
    commands: commands(), enabled: true, layout: { width: 300, height: 200 }, haptics: { light: jest.fn() },
    onInteraction: jest.fn(), onToggleControls: jest.fn(), onSkipFeedback: jest.fn(), onLongPressRate: jest.fn(), ...overrides,
  };
}

describe("useTapGestures", () => {
  it("single tap toggles controls and counts as interaction", () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.single), [{ x: 150, y: 100 }]);
    expect(i.onToggleControls).toHaveBeenCalledTimes(1);
    expect(i.onInteraction).toHaveBeenCalledTimes(1);
  });
  it("double tap left third seeks back with haptic and feedback", () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.double), [{ x: 50, y: 100 }]);
    expect(i.commands.seekBy).toHaveBeenCalledWith(-SKIP_MS);
    expect(i.haptics.light).toHaveBeenCalledTimes(1);
    expect(i.onSkipFeedback).toHaveBeenCalledWith("back");
  });
  it("double tap right third seeks forward; centre third toggles play", () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.double), [{ x: 250, y: 100 }]);
    expect(i.commands.seekBy).toHaveBeenLastCalledWith(SKIP_MS);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.double), [{ x: 150, y: 100 }]);
    expect(i.commands.togglePlay).toHaveBeenCalledTimes(1);
  });
  it("long press toggles the rate flag on start and end", () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<LongPressGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.longPress), [
      { state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END },
    ]);
    expect(i.onLongPressRate.mock.calls).toEqual([[true], [false]]);
  });
  it("disabled: nothing fires", () => {
    const i = input({ enabled: false });
    render(<Harness {...i} />);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.single), [{ x: 150, y: 100 }]);
    expect(i.onToggleControls).not.toHaveBeenCalled();
  });
});
