// components/VideoPlayer/gestures/useControlsVisibility.ts
// Rules V1-V9: docs/player/06-ui-and-gestures-spec.md §3
import { useCallback, useEffect, useRef, useState } from "react";
import { runOnJS, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { AUTO_HIDE_MS, CONTROLS_FADE_MS, INITIAL_VISIBLE_MS } from "../constants";
import type { PlaybackStatus } from "../engine/types";

export interface ControlsVisibilityInput {
  readonly status: PlaybackStatus;
  readonly isSheetOpen: boolean;
  readonly isMinimized: boolean;
}

export interface ControlsVisibility {
  readonly visible: boolean;
  readonly opacity: SharedValue<number>;
  show(): void;
  hide(): void;
  onInteraction(): void;
}

export function useControlsVisibility({ status, isSheetOpen, isMinimized }: ControlsVisibilityInput): ControlsVisibility {
  const [visible, setVisible] = useState(true);
  const opacity = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstScheduleRef = useRef(true);
  const statusRef = useRef(status);
  const sheetRef = useRef(isSheetOpen);
  statusRef.current = status;
  sheetRef.current = isSheetOpen;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    opacity.value = withTiming(0, { duration: CONTROLS_FADE_MS }, (finished) => {
      if (finished) runOnJS(setVisible)(false);
    });
  }, [clearTimer, opacity]);

  const show = useCallback(() => {
    setVisible(true);
    opacity.value = withTiming(1, { duration: CONTROLS_FADE_MS });
  }, [opacity]);

  const schedule = useCallback(
    (delayMs: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (statusRef.current === "playing" && !sheetRef.current) hide();
      }, delayMs);
    },
    [clearTimer, hide],
  );

  const onInteraction = useCallback(() => {
    show();
    if (statusRef.current === "playing" && !sheetRef.current) schedule(AUTO_HIDE_MS);
  }, [show, schedule]);

  // V1, V4, V5, V7
  useEffect(() => {
    if (isMinimized) {
      clearTimer();
      return;
    }
    if (status === "playing" && !isSheetOpen) {
      schedule(firstScheduleRef.current ? INITIAL_VISIBLE_MS : AUTO_HIDE_MS);
      firstScheduleRef.current = false;
      return;
    }
    show();
    clearTimer();
  }, [status, isSheetOpen, isMinimized, schedule, show, clearTimer]);

  // V8
  useEffect(() => clearTimer, [clearTimer]);

  return { visible, opacity, show, hide, onInteraction };
}
