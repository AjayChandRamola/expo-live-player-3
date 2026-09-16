// components/VideoPlayer/ui/ProgressBar.tsx
// Spec: docs/player/06-ui-and-gestures-spec.md §5.3 and §4.3
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, Pressable, Text, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { ChapterItem } from "../../../types/domain";
import { CHAPTER_MARKER_HIT_SLOP, PRESS_SPRING, SKIP_MS } from "../constants";
import { clamp } from "../engine/pure/clamp";
import { formatTime } from "../engine/pure/formatTime";
import type { HapticsAdapter } from "../platform/types";
import { styles } from "./ProgressBar.styles";

export interface ProgressBarProps {
  readonly positionMs: number;
  readonly durationMs: number;
  readonly bufferedMs: number;
  readonly chapters?: readonly ChapterItem[];
  readonly isLive: boolean;
  readonly disabled?: boolean;
  readonly onSeekStart: () => void;
  readonly onSeekPreview: (ms: number) => void;
  readonly onSeekCommit: (ms: number) => void;
  readonly onSeekCancel: () => void;
  readonly haptics: HapticsAdapter;
  readonly testID?: string;
}

export const PROGRESS_BAR_TEST_IDS = {
  track: "progress-track",
  played: "progress-played",
  buffered: "progress-buffered",
  thumb: "progress-thumb",
  preview: "progress-preview",
  chapter: (index: number) => `progress-chapter-${index}`,
} as const;

const THUMB_SCRUB_SCALE = 1.4;
const PAN_ACTIVATION_PX = 4;

function percent(ms: number, durationMs: number): `${number}%` {
  const fraction = durationMs > 0 ? clamp(ms / durationMs, 0, 1) : 0;
  return `${fraction * 100}%`;
}

export const ProgressBar = memo(function ProgressBar({
  positionMs,
  durationMs,
  bufferedMs,
  chapters,
  isLive,
  disabled = false,
  onSeekStart,
  onSeekPreview,
  onSeekCommit,
  onSeekCancel,
  haptics,
  testID,
}: ProgressBarProps) {
  const [previewMs, setPreviewMs] = useState<number | null>(null);
  const thumbScale = useSharedValue(1);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ scale: thumbScale.value }] }));

  // Width is a ref, not state: no render depends on it, and RNGH's jest
  // test registry keeps returning the first-rendered gesture handler, so a
  // gesture rebuilt from changing state would read a stale closure value.
  const widthRef = useRef(0);
  const durationRef = useRef(durationMs);
  durationRef.current = durationMs;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
  }, []);
  const msAt = useCallback(
    (x: number) => (widthRef.current > 0 ? Math.round(clamp(x / widthRef.current, 0, 1) * durationRef.current) : 0),
    [],
  );

  const commit = useCallback(
    (ms: number) => {
      setPreviewMs(null);
      thumbScale.value = withSpring(1, PRESS_SPRING);
      if (disabled) return; // gesture test utilities may invoke callbacks even on disabled gestures
      onSeekCommit(ms);
      haptics.light();
    },
    [disabled, haptics, onSeekCommit, thumbScale],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .withTestId("progress-tap")
        .enabled(!disabled)
        .runOnJS(true)
        .onEnd((event) => commit(msAt(event.x))),
    [commit, disabled, msAt],
  );

  const preview = useCallback(
    (x: number) => {
      const ms = msAt(x);
      setPreviewMs(ms);
      onSeekPreview(ms);
    },
    [msAt, onSeekPreview],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId("progress-pan")
        .enabled(!disabled)
        .runOnJS(true)
        .activeOffsetX([-PAN_ACTIVATION_PX, PAN_ACTIVATION_PX])
        .onBegin(() => {
          thumbScale.value = withSpring(THUMB_SCRUB_SCALE, PRESS_SPRING);
          onSeekStart();
        })
        // RNGH calls onStart (not onUpdate) for the event that transitions
        // the gesture into ACTIVE; without handling it too, the first
        // movement tick of every scrub would report no preview at all.
        .onStart((event) => preview(event.x))
        .onUpdate((event) => preview(event.x))
        // RNGH also calls onEnd (with success=false) for a cancelled or
        // failed gesture, not just a completed one; committing here
        // unconditionally would seek on a cancelled scrub. onFinalize's
        // !success branch is what handles the cancel path.
        .onEnd((event, success) => {
          if (success) commit(msAt(event.x));
        })
        .onFinalize((_event, success) => {
          if (!success) {
            setPreviewMs(null);
            thumbScale.value = withSpring(1, PRESS_SPRING);
            onSeekCancel();
          }
        }),
    [commit, disabled, msAt, onSeekCancel, onSeekStart, preview, thumbScale],
  );

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === "increment") commit(clamp(positionMs + SKIP_MS, 0, durationMs));
      else if (name === "decrement") commit(clamp(positionMs - SKIP_MS, 0, durationMs));
    },
    [commit, durationMs, positionMs],
  );

  if (isLive && durationMs <= 0) return null; // live without a seekable window

  const shownMs = previewMs ?? positionMs;

  return (
    <View
      style={styles.container}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Seek"
      accessibilityValue={{ min: 0, max: durationMs, now: positionMs, text: `${formatTime(positionMs)} of ${formatTime(durationMs)}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View style={styles.hitArea}>
          <View style={styles.track} onLayout={onLayout} testID={PROGRESS_BAR_TEST_IDS.track}>
            <View style={[styles.fill, styles.buffered, { width: percent(bufferedMs, durationMs) }]} testID={PROGRESS_BAR_TEST_IDS.buffered} />
            <View style={[styles.fill, styles.played, { width: percent(shownMs, durationMs) }]} testID={PROGRESS_BAR_TEST_IDS.played} />
            {chapters?.map((chapter, index) =>
              durationMs > 0 ? (
                <Pressable
                  key={`${chapter.startMs}-${index}`}
                  testID={PROGRESS_BAR_TEST_IDS.chapter(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Chapter ${chapter.title}`}
                  hitSlop={CHAPTER_MARKER_HIT_SLOP}
                  onPress={() => commit(chapter.startMs)}
                  style={[styles.chapterTick, { left: percent(chapter.startMs, durationMs) }]}
                />
              ) : null,
            )}
            <Animated.View style={[styles.thumb, { left: percent(shownMs, durationMs) }, thumbStyle]} testID={PROGRESS_BAR_TEST_IDS.thumb} />
          </View>
          {previewMs !== null ? (
            <View style={[styles.preview, { left: percent(previewMs, durationMs) }]} testID={PROGRESS_BAR_TEST_IDS.preview}>
              <Text style={styles.previewText}>{formatTime(previewMs)}</Text>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
});
