/**
 * components/Shorts/ShortProgressBar.tsx
 * 
 * Thin progress bar showing video playback progress
 * - Smooth animation
 * - Positioned at bottom of screen
 * - YouTube Shorts style
 * 
 * Production-ready, accessible, performant
 */

import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

interface ShortProgressBarProps {
  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Optional custom color (default: white)
   */
  color?: string;

  /**
   * Optional testID for testing
   */
  testID?: string;
}

/**
 * ShortProgressBar Component
 * 
 * Displays a thin progress bar at the bottom of the short video
 */
function ShortProgressBarComponent({
  progress,
  color = "#FFFFFF",
  testID = "short-progress-bar",
}: ShortProgressBarProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${Math.max(0, Math.min(100, progress))}%`, {
        duration: 100,
      }),
    };
  });

  return (
    <View style={styles.container} testID={testID}>
      <Animated.View
        style={[
          styles.progressBar,
          { backgroundColor: color },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  progressBar: {
    height: "100%",
    borderRadius: 1.5,
  },
});

// Memoize to prevent unnecessary re-renders
export const ShortProgressBar = memo(ShortProgressBarComponent);

export default ShortProgressBar;

