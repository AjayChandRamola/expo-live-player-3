/**
 * components/VideoPlayer/VideoTimeOverlay.tsx
 * 
 * YouTube-style time display below progress bar
 * - Current time on left
 * - Total duration on right
 * - Format: mm:ss (under 60 min) or hh:mm:ss (over 60 min)
 * 
 * Production-ready, accessible
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";

interface VideoTimeOverlayProps {
  /**
   * Current playback position in milliseconds
   */
  currentTime: number;

  /**
   * Total duration in milliseconds
   */
  duration: number;

  /**
   * Optional text color (defaults to white)
   */
  textColor?: string;
}

/**
 * Format time for display
 * - Under 60 minutes → mm:ss
 * - Over 60 minutes → hh:mm:ss
 */
const formatTime = (ms: number): string => {
  if (!ms || isNaN(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor((total % 3600) / 60);
  const h = Math.floor(total / 3600);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
};

/**
 * VideoTimeOverlay Component
 */
export function VideoTimeOverlay({
  currentTime,
  duration,
  textColor = "#FFFFFF",
}: VideoTimeOverlayProps) {
  const currentTimeText = useMemo(() => formatTime(currentTime), [currentTime]);
  const durationText = useMemo(() => formatTime(duration), [duration]);

  return (
    <View style={styles.container} accessibilityRole="text">
      <Text style={[styles.timeText, { color: textColor }]} accessibilityLabel={`Current time: ${currentTimeText}`}>
        {currentTimeText}
      </Text>
      <Text style={[styles.timeText, { color: textColor }]} accessibilityLabel={`Duration: ${durationText}`}>
        {durationText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 0, // No vertical padding to minimize spacing
    marginTop: 0, // Removed margin to eliminate gap between progress bar and time display
  },
  timeText: {
    fontSize: 11, // YouTube-style smaller text (11-12px)
    fontWeight: "400",
    fontVariant: ["tabular-nums"], // Monospaced numbers for consistent width
    opacity: 0.7, // Light opacity like YouTube
  },
});

