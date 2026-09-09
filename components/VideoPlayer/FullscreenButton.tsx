/**
 * components/VideoPlayer/FullscreenButton.tsx
 * 
 * YouTube 2025-style Fullscreen/Minimize toggle button
 * - Positioned at bottom-right corner
 * - Auto-hides with other controls (3s inactivity)
 * - Smooth animations and transitions
 * - Cross-platform support (iOS, Android, Web)
 */

import React, { useRef, useEffect } from "react";
import * as RN from "react-native";
import { IconButton } from "react-native-paper";

interface FullscreenButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
  opacity?: RN.Animated.Value | number;
  size?: number;
  style?: RN.ViewStyle;
}

const FullscreenButton: React.FC<FullscreenButtonProps> = ({
  isFullscreen,
  onToggle,
  opacity = 1,
  size = 48,
  style,
}) => {
  // Animation values
  const scaleAnim = useRef(new RN.Animated.Value(1)).current;
  const [isHovered, setIsHovered] = React.useState(false);

  // Handle press with animation
  const handlePress = () => {
    // Scale animation on press
    RN.Animated.sequence([
      RN.Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 100,
        easing: RN.Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      RN.Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    onToggle();
  };

  // Hover effects for web
  const handleHoverIn = () => setIsHovered(true);
  const handleHoverOut = () => setIsHovered(false);

  const webHoverProps = RN.Platform.OS === "web" ? {
    onMouseEnter: handleHoverIn,
    onMouseLeave: handleHoverOut,
  } : {};

  // Icon selection
  const icon = isFullscreen ? "fullscreen-exit" : "fullscreen";
  const accessibilityLabel = isFullscreen 
    ? "Exit fullscreen" 
    : "Enter fullscreen";

  return (
    <RN.Animated.View
      style={[
        styles.container,
        style,
        {
          opacity,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <RN.Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          isHovered && styles.hovered,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Double tap to toggle fullscreen mode"
        {...webHoverProps}
      >
        <RN.View style={styles.iconWrapper}>
          <IconButton
            icon={icon}
            size={size * 0.5}
            iconColor="#FFFFFF"
            style={styles.icon}
          />
        </RN.View>
      </RN.Pressable>

      {/* Tooltip for web */}
      {RN.Platform.OS === "web" && isHovered && (
        <RN.View style={styles.tooltip}>
          <RN.Text style={styles.tooltipText}>
            {isFullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
          </RN.Text>
        </RN.View>
      )}
    </RN.Animated.View>
  );
};

const styles = RN.StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    // Shadow for depth (YouTube style)
    ...RN.Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      },
    }),
  },
  hovered: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    ...RN.Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
      },
    }),
  },
  pressed: {
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  iconWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    margin: 0,
  },
  tooltip: {
    position: "absolute",
    bottom: -36,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 120,
    alignItems: "center",
    ...RN.Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
      },
    }),
  },
  tooltipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
});

export default React.memo(FullscreenButton);
export type { FullscreenButtonProps };

