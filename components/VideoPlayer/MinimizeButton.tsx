/**
 * components/VideoPlayer/MinimizeButton.tsx
 *
 * YouTube-style Minimize/Restore Video button component
 * - Matches YouTube's in-player dark theme aesthetic (2024-2025)
 * - Inverted caret icon (˄) for minimize, (˅) for restore
 * - Pure white icon on dark circular background
 * - 48px diameter (smaller than play/pause for secondary control)
 * - Rotates 180° when toggling between minimize/restore states
 * - Material Design shadow and smooth animations
 *
 * Dependencies: react, react-native, react-native-svg
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  Platform,
} from "react-native";
import Svg, { Path } from "react-native-svg";

export type MinimizeButtonProps = {
  /** Animated opacity value controlled by controller hook */
  opacity?: Animated.Value;
  /** Whether video is currently minimized (affects icon rotation) */
  isMinimized?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Callback when user presses the button */
  onPress: () => void;
  /** Diameter in px (default 48 to match YouTube's secondary controls) */
  size?: number;
  /** Optional style to augment wrapper */
  style?: ViewStyle;
  /** Whether to show pressed state animation */
  showPressedState?: boolean;
};

/**
 * YouTube-style Minimize/Restore icon (SVG)
 * Upward caret (˄) that rotates 180° when clicked
 * - Normal state (180°): Shows downward caret (˅) = "Minimize down"
 * - Minimized state (0°): Shows upward caret (˄) = "Restore up"
 * Pure white (#FFFFFF) for active, gray (#999999) for disabled
 */
const MinimizeIcon: React.FC<{
  size: number;
  color: string;
  rotation: Animated.Value;
}> = ({ size, color, rotation }) => {
  const iconSize = Math.round(size * 0.5);
  const viewBox = "0 0 24 24";

  const AnimatedSvg = Animated.createAnimatedComponent(Svg);

  return (
    <AnimatedSvg
      width={iconSize}
      height={iconSize}
      viewBox={viewBox}
      style={{
        transform: [
          {
            rotate: rotation.interpolate({
              inputRange: [0, 180],
              outputRange: ["0deg", "180deg"],
            }),
          },
        ],
      }}
    >
      {/* Upward caret (˄) - base icon that rotates to show minimize/restore */}
      <Path
        d="M7 14L12 9L17 14"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </AnimatedSvg>
  );
};

/**
 * Pure presentational animated circular button.
 * Matches YouTube's Minimize/Restore button aesthetic.
 */
export const MinimizeButton: React.FC<MinimizeButtonProps> = React.memo(
  ({
    opacity,
    isMinimized = false,
    disabled = false,
    onPress,
    size = 48,
    style,
    showPressedState = true,
  }) => {
    // YouTube color scheme
    const iconColor = disabled ? "#999999" : "#FFFFFF";
    const bgOpacity = disabled ? 0.4 : 0.65;
    const backgroundColor = `rgba(0,0,0,${bgOpacity})`;

    // Rotation animation for icon (180° = minimize/downward, 0° = restore/upward)
    const rotationAnim = useRef(new Animated.Value(isMinimized ? 0 : 180)).current;

    // Update rotation when isMinimized changes
    useEffect(() => {
      Animated.spring(rotationAnim, {
        toValue: isMinimized ? 0 : 180,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }).start();
    }, [isMinimized, rotationAnim]);

    // Pressed state animation
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      if (!disabled && showPressedState) {
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

    const accessibilityLabel = isMinimized
      ? "Restore video to full screen (upward caret)"
      : "Minimize video to picture-in-picture (downward caret)";

    return (
      <Animated.View pointerEvents="box-none" style={containerStyle}>
        <Pressable
          accessible
          accessibilityLabel={disabled ? `${accessibilityLabel} (unavailable)` : accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            if (!disabled) {
              try {
                onPress();
              } catch (e) {
                console.warn("[MinimizeButton][Error] onPress failed:", e);
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
          <MinimizeIcon size={size} color={iconColor} rotation={rotationAnim} />
        </Pressable>
      </Animated.View>
    );
  }
);

MinimizeButton.displayName = "MinimizeButton";

const styles = StyleSheet.create({
  container: {
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

export default MinimizeButton;

