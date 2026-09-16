// components/VideoPlayer/gestures/useTapGestures.ts
// Single tap, double tap zones, long press. Spec: 06 §4.1
import { useMemo } from "react";
import { Gesture, type GestureType } from "react-native-gesture-handler";
import { DOUBLE_TAP_WINDOW_MS, LONG_PRESS_MS, SKIP_MS } from "../constants";
import type { PlaybackCommands } from "../engine/types";
import type { HapticsAdapter } from "../platform/types";

export interface TapGesturesInput {
  readonly commands: PlaybackCommands;
  readonly enabled: boolean;
  readonly layout: { readonly width: number; readonly height: number };
  readonly haptics: HapticsAdapter;
  readonly onInteraction: () => void;
  readonly onToggleControls: () => void;
  readonly onSkipFeedback: (direction: "back" | "forward") => void;
  readonly onLongPressRate: (active: boolean) => void;
}

export const TAP_GESTURE_TEST_IDS = { single: "player-tap", double: "player-double-tap", longPress: "player-long-press" } as const;

const THIRDS = 3;

export function useTapGestures(input: TapGesturesInput): GestureType {
  const { commands, enabled, layout, haptics, onInteraction, onToggleControls, onSkipFeedback, onLongPressRate } = input;

  return useMemo(() => {
    const single = Gesture.Tap()
      .withTestId(TAP_GESTURE_TEST_IDS.single)
      .enabled(enabled)
      .runOnJS(true)
      .numberOfTaps(1)
      .maxDuration(DOUBLE_TAP_WINDOW_MS)
      .onEnd(() => {
        if (!enabled) return; // belt and braces: jest-utils may fire disabled handlers
        onToggleControls();
        onInteraction();
      });

    const double = Gesture.Tap()
      .withTestId(TAP_GESTURE_TEST_IDS.double)
      .enabled(enabled)
      .runOnJS(true)
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_WINDOW_MS)
      .onEnd((event) => {
        if (!enabled) return;
        const third = layout.width / THIRDS;
        if (event.x < third) {
          commands.seekBy(-SKIP_MS);
          haptics.light();
          onSkipFeedback("back");
        } else if (event.x > layout.width - third) {
          commands.seekBy(SKIP_MS);
          haptics.light();
          onSkipFeedback("forward");
        } else {
          commands.togglePlay();
        }
        onInteraction();
      });

    const longPress = Gesture.LongPress()
      .withTestId(TAP_GESTURE_TEST_IDS.longPress)
      .enabled(enabled)
      .runOnJS(true)
      .minDuration(LONG_PRESS_MS)
      .onStart(() => {
        if (enabled) onLongPressRate(true);
      })
      .onFinalize(() => {
        if (enabled) onLongPressRate(false);
      });

    return Gesture.Simultaneous(Gesture.Exclusive(double, single), longPress);
  }, [commands, enabled, layout.width, haptics, onInteraction, onToggleControls, onSkipFeedback, onLongPressRate]);
}
