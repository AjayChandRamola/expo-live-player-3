/**
 * components/VideoPlayer/PreviousVideoButton.tsx
 *
 * YouTube-style Previous Video button component
 * - Matches YouTube's in-player dark theme aesthetic (2024-2025)
 * - Pure white double-arrow icon on dark circular background
 * - Supports active and disabled states
 * - 64px diameter (smaller than play/pause button for visual hierarchy)
 * - Material Design shadow and hover effects
 *
 * Dependencies: react, react-native, react-native-svg
 */

import React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  Platform,
} from "react-native";
import Svg, { Path } from "react-native-svg";

export type PreviousVideoButtonProps = {
  /** Animated opacity value controlled by controller hook */
  opacity?: Animated.Value;
  /** Whether the button is disabled (no previous video available) */
  disabled?: boolean;
  /** Callback when user presses the button */
  onPress: () => void;
  /** Diameter in px (default 64 to match YouTube's proportions) */
  size?: number;
  /** Optional style to augment wrapper */
  style?: ViewStyle;
  /** Whether to show pressed state animation */
  showPressedState?: boolean;
};

/**
 * YouTube-style double-arrow Previous icon (SVG)
 * Pure white (#FFFFFF) for active, gray (#999999) for disabled
 */
const PreviousIcon: React.FC<{
  size: number;
  color: string;
}> = ({ size, color }) => {
  const iconSize = Math.round(size * 0.5);
  const viewBox = "0 0 24 24";

  return (
    <Svg width={iconSize} height={iconSize} viewBox={viewBox}>
      {/* Left arrow */}
      <Path
        d="M11 6L6 12L11 18V6Z"
        fill={color}
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right arrow */}
      <Path
        d="M18 6L13 12L18 18V6Z"
        fill={color}
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

/**
 * Pure presentational animated circular button.
 * Matches YouTube's Previous Video button aesthetic.
 */
export const PreviousVideoButton: React.FC<PreviousVideoButtonProps> =
  React.memo(
    ({
      opacity,
      disabled = false,
      onPress,
      size = 64,
      style,
      showPressedState = true,
    }) => {
      // YouTube color scheme
      const iconColor = disabled ? "#999999" : "#FFFFFF";
      const bgOpacity = disabled ? 0.4 : 0.65;
      const backgroundColor = `rgba(0,0,0,${bgOpacity})`;

      // Pressed state animation
      const [pressed, setPressed] = React.useState(false);
      const scaleAnim = React.useRef(new Animated.Value(1)).current;

      const handlePressIn = () => {
        if (!disabled && showPressedState) {
          setPressed(true);
          Animated.spring(scaleAnim, {
            toValue: 0.92,
            useNativeDriver: true,
            speed: 50,
            bounciness: 0,
          }).start();
        }
      };

      const handlePressOut = () => {
        if (!disabled && showPressedState) {
          setPressed(false);
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 8,
          }).start();
        }
      };

      const containerStyle = opacity
        ? [
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity,
              transform: [{ scale: scaleAnim }],
            },
            style,
          ]
        : [
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [{ scale: scaleAnim }],
            },
            style,
          ];

      return (
        <Animated.View pointerEvents="box-none" style={containerStyle}>
          <Pressable
            accessible
            accessibilityLabel={
              disabled ? "Previous video (unavailable)" : "Previous video"
            }
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => {
              if (!disabled) {
                try {
                  onPress();
                } catch (e) {
                  console.warn("[PreviousVideoButton][Error] onPress failed:", e);
                }
              }
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              styles.button,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor,
              },
              disabled && styles.buttonDisabled,
            ]}
          >
            <PreviousIcon size={size} color={iconColor} />
          </Pressable>
        </Animated.View>
      );
    }
  );

PreviousVideoButton.displayName = "PreviousVideoButton";

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
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {},
      default: {
        // Web shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  buttonDisabled: {
    elevation: 0,
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {},
      default: {
        shadowOpacity: 0,
      },
    }),
  },
});

export default PreviousVideoButton;

