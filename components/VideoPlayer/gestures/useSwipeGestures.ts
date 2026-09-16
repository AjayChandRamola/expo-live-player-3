// components/VideoPlayer/gestures/useSwipeGestures.ts
// Vertical pan: left half brightness, right half volume. Spec: 06 §4.2
import { useEffect, useMemo, useRef } from "react";
import { Gesture, type GestureType } from "react-native-gesture-handler";
import { SWIPE_ACTIVATION_PX, SWIPE_INDICATOR_HIDE_MS } from "../constants";
import { clamp } from "../engine/pure/clamp";
import type { PlaybackCommands } from "../engine/types";
import type { BrightnessAdapter } from "../platform/types";
import type { SwipeLevel } from "../ui/SwipeIndicator";

export interface SwipeGesturesInput {
  readonly commands: PlaybackCommands;
  readonly enabled: boolean;
  readonly layout: { readonly width: number; readonly height: number };
  readonly brightness: BrightnessAdapter;
  readonly initialVolume: number;
  readonly onLevel: (level: SwipeLevel | null) => void;
}

export const SWIPE_GESTURE_TEST_ID = "player-swipe";

export function useSwipeGestures(input: SwipeGesturesInput): GestureType {
  const { commands, enabled, layout, brightness, initialVolume, onLevel } = input;
  const sideRef = useRef<SwipeLevel["kind"]>("volume");
  const startLevelRef = useRef(initialVolume);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  return useMemo(() => {
    const applyDelta = (translationY: number) => {
      if (!enabled) return;
      const level = clamp(startLevelRef.current - translationY / Math.max(1, layout.height), 0, 1);
      if (sideRef.current === "volume") commands.setVolume(level);
      else void brightness.set(level);
      onLevel({ kind: sideRef.current, level });
    };

    return Gesture.Pan()
        .withTestId(SWIPE_GESTURE_TEST_ID)
        .enabled(enabled)
        .runOnJS(true)
        .activeOffsetY([-SWIPE_ACTIVATION_PX, SWIPE_ACTIVATION_PX])
        .failOffsetX([-SWIPE_ACTIVATION_PX, SWIPE_ACTIVATION_PX])
        .onBegin((event) => {
          if (hideTimerRef.current !== null) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
          const side: SwipeLevel["kind"] = event.x < layout.width / 2 ? "brightness" : "volume";
          sideRef.current = side;
          if (side === "volume") {
            startLevelRef.current = initialVolume;
          } else {
            startLevelRef.current = 1;
            brightness.get().then((level) => {
              startLevelRef.current = level;
            });
          }
        })
        .onStart((event) => applyDelta(event.translationY))
        .onUpdate((event) => applyDelta(event.translationY))
        .onFinalize(() => {
          hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            onLevel(null);
          }, SWIPE_INDICATOR_HIDE_MS);
        });
  }, [brightness, commands, enabled, initialVolume, layout.height, layout.width, onLevel]);
}
