/**
 * components/VideoPlayer/PlayPauseButton.tsx
 *
 * Reusable PlayPauseButton component
 * - Uses Animated.View to fade in/out using an external Animated.Value.
 * - Large circular button (default 80px), accessible and defensive.
 * - Pure presentational component (React.memo).
 *
 * Dependencies: react, react-native, @expo/vector-icons
 */

import React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type PlayPauseButtonProps = {
  /** Animated opacity value controlled by controller hook */
  opacity: Animated.Value;
  /** Whether the video is currently playing (icon selection) */
  isPlaying: boolean;
  /** Callback when user presses the circular button */
  onPress: () => void;
  /** diameter in px (70–90 recommended) */
  size?: number;
  /** optional style to augment wrapper */
  style?: ViewStyle;
  /** color of icon / background accent */
  accentColor?: string;
};

/**
 * Pure presentational animated circular button.
 * - Expects an external Animated.Value for opacity control so visibility logic is centralized.
 */
export const PlayPauseButton: React.FC<PlayPauseButtonProps> = React.memo(
  ({
    opacity,
    isPlaying,
    onPress,
    size = 80,
    style,
    accentColor = "#0ea5ff",
  }) => {
    const iconName = isPlaying ? "pause" : "play";
    const iconSize = Math.round(size * 0.46);

    return (
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 2, opacity },
          style,
        ]}
      >
        <Pressable
          accessible
          accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
          accessibilityRole="button"
          onPress={() => {
            try {
              onPress();
            } catch (e) {
              console.warn("[PlayPauseButton][Error] onPress failed:", e);
            }
          }}
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: "rgba(0,0,0,0.55)",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={iconName}
            size={iconSize}
            color={accentColor}
          />
        </Pressable>
      </Animated.View>
    );
  }
);

PlayPauseButton.displayName = "PlayPauseButton";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {},
      default: {},
    }),
  },
});

export default PlayPauseButton;