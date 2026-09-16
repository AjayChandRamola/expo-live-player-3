/**
 * components/VideoPlayer/VideoProgressBar.tsx
 * 
 * YouTube-style video progress bar
 * - Full track with buffered and played sections
 * - Interactive scrubber with drag support
 * - Time preview on drag
 * - Smooth animations
 * 
 * Production-ready, accessible, performant
 */

import React, { useCallback, useRef, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  Dimensions,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import Logger from "../../utils/Logger";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface VideoProgressBarProps {
  /**
   * Current playback position in milliseconds
   */
  position: number;

  /**
   * Total duration in milliseconds
   */
  duration: number;

  /**
   * Buffered position in milliseconds
   */
  buffered?: number;

  /**
   * Whether video is playing
   */
  isPlaying: boolean;

  /**
   * Callback when user seeks to a position
   */
  onSeek: (position: number) => void;

  /**
   * Optional callback when dragging starts
   */
  onDragStart?: () => void;

  /**
   * Optional callback when dragging ends
   */
  onDragEnd?: () => void;

  /**
   * Video container width (defaults to screen width)
   */
  containerWidth?: number;
}

/**
 * Format time for display
 */
const formatTime = (ms: number): string => {
  if (!ms || isNaN(ms)) return "0:00";
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor((total % 3600) / 60);
  const h = Math.floor(total / 3600);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
};

/**
 * VideoProgressBar Component
 */
export function VideoProgressBar({
  position,
  duration,
  buffered = 0,
  isPlaying,
  onSeek,
  onDragStart,
  onDragEnd,
  containerWidth = SCREEN_WIDTH,
}: VideoProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [showTimePreview, setShowTimePreview] = useState(false);
  const [timePreviewLeft, setTimePreviewLeft] = useState(0);

  const translateX = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const bufferedWidth = useSharedValue(0);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (!duration || duration === 0) return 0;
    const current = isDragging ? dragPosition : position;
    return Math.min(100, Math.max(0, (current / duration) * 100));
  }, [position, duration, isDragging, dragPosition]);

  const bufferedPercent = useMemo(() => {
    if (!duration || duration === 0) return 0;
    return Math.min(100, Math.max(0, (buffered / duration) * 100));
  }, [buffered, duration]);

  // Update animated values
  React.useEffect(() => {
    const width = containerWidth * (progressPercent / 100);
    const bufferedW = containerWidth * (bufferedPercent / 100);
    const scrubberX = width - 8; // Center scrubber on progress end

    progressWidth.value = withSpring(width, { damping: 15, stiffness: 150 });
    bufferedWidth.value = withSpring(bufferedW, { damping: 15, stiffness: 150 });
    translateX.value = withSpring(scrubberX, { damping: 15, stiffness: 150 });
  }, [progressPercent, bufferedPercent, containerWidth, translateX, progressWidth, bufferedWidth]);

  /**
   * Handle tap on progress bar
   */
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const { locationX } = event.nativeEvent;
      const percent = Math.max(0, Math.min(100, (locationX / containerWidth) * 100));
      const seekPosition = (percent / 100) * duration;

      Logger.info(`[VideoProgressBar] Tap seek to ${formatTime(seekPosition)}`, {
        position: seekPosition,
        percent,
      });

      onSeek(seekPosition);
    },
    [containerWidth, duration, onSeek]
  );

  /**
   * Handle drag gesture
   */
  const panGesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(setIsDragging)(true);
      runOnJS(setShowTimePreview)(true);
      onDragStart?.();
      Logger.info("[VideoProgressBar] Drag started");
    })
    .onUpdate((event) => {
      const deltaX = event.translationX;
      const currentX = containerWidth * (progressPercent / 100) + deltaX;
      const clampedX = Math.max(0, Math.min(containerWidth, currentX));
      const percent = (clampedX / containerWidth) * 100;
      const seekPosition = (percent / 100) * duration;

      translateX.value = clampedX - 8;
      progressWidth.value = clampedX;

      runOnJS(setDragPosition)(seekPosition);
      runOnJS(setTimePreviewLeft)(clampedX - 30);
    })
    .onEnd((event) => {
      const deltaX = event.translationX;
      const currentX = containerWidth * (progressPercent / 100) + deltaX;
      const clampedX = Math.max(0, Math.min(containerWidth, currentX));
      const percent = (clampedX / containerWidth) * 100;
      const seekPosition = (percent / 100) * duration;

      runOnJS(setIsDragging)(false);
      runOnJS(setShowTimePreview)(false);
      runOnJS(onSeek)(seekPosition);
      onDragEnd?.();

      Logger.info(`[VideoProgressBar] Drag ended, seek to ${formatTime(seekPosition)}`, {
        position: seekPosition,
        percent,
      });
    });

  /**
   * Animated styles
   */
  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: progressWidth.value,
  }));

  const bufferedAnimatedStyle = useAnimatedStyle(() => ({
    width: bufferedWidth.value,
  }));

  const scrubberAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const currentTime = isDragging ? dragPosition : position;
  const timeText = formatTime(currentTime);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View
        style={[styles.wrapper, { width: containerWidth }]}
        accessibilityRole="adjustable"
        accessibilityLabel={`Video progress bar. Current time: ${timeText}`}
        accessibilityValue={{
          min: 0,
          max: duration,
          now: currentTime,
        }}
      >
        {/* Full Track */}
        <View style={styles.fullTrack}>
          {/* Buffered Track */}
          <Animated.View style={[styles.bufferedTrack, bufferedAnimatedStyle]} />

          {/* Played Track */}
          <Animated.View style={[styles.playedTrack, progressAnimatedStyle]} />
        </View>

        {/* Scrubber Handle */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[styles.scrubber, scrubberAnimatedStyle]}
            accessibilityLabel="Scrubber handle. Drag to seek through video"
          />
        </GestureDetector>

        {/* Tap Area */}
        <View style={styles.tapArea} onTouchEnd={handlePress} />

        {/* Time Preview (shown during drag) */}
        {showTimePreview && isDragging && (
          <View
            style={[
              styles.timePreview,
              {
                left: timePreviewLeft,
              },
            ]}
          >
            <Animated.Text style={styles.timePreviewText}>{timeText}</Animated.Text>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 4,
    width: "100%",
    backgroundColor: "transparent", // No background, sits on white container
  },
  wrapper: {
    height: 4,
    position: "relative",
    marginHorizontal: 12, // Match YouTube padding
  },
  fullTrack: {
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.15)", // YouTube-style lighter track in portrait
    borderRadius: 2,
    overflow: "hidden",
  },
  bufferedTrack: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.3)", // YouTube-style darker buffered track
    borderRadius: 2,
  },
  playedTrack: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 4,
    backgroundColor: "#FF0000", // YouTube-red (same in portrait and fullscreen)
    borderRadius: 2,
  },
  scrubber: {
    position: "absolute",
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF0000",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tapArea: {
    ...StyleSheet.absoluteFillObject,
    height: 40, // Larger tap area
    top: -18,
    zIndex: 999, // Below buttons but above progress bar
  },
  timePreview: {
    position: "absolute",
    bottom: 32, // Above progress bar and scrubber with safe spacing (prevents overlap with action bar below)
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 60,
    alignItems: "center",
    zIndex: 1001, // Above progress bar but below buttons
    pointerEvents: "none", // Don't interfere with gestures
  },
  timePreviewText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});

