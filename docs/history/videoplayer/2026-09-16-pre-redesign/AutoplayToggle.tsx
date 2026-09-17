// components/VideoPlayer/AutoplayToggle.tsx
/**
 * Modern YouTube 2025-style Autoplay Toggle Button
 * 
 * Design Features:
 * - Rounded capsule toggle with smooth animations
 * - Material 3 dark mode aesthetic
 * - ON state: Blue glow (#3EA6FF) with play icon
 * - OFF state: Gray translucent with pause icon
 * - Hover effects, tooltip, and accessibility support
 * 
 * Dependencies:
 *   - react
 *   - react-native
 *   - react-native-paper (IconButton)
 */

import React, { useRef, useEffect } from "react";
import * as RN from "react-native";
import { IconButton } from "react-native-paper";

interface AutoplayToggleProps {
  autoplayEnabled: boolean;
  onToggle: () => void;
  size?: number;
  disabled?: boolean;
  opacity?: RN.Animated.Value | number;
}

const AutoplayToggle: React.FC<AutoplayToggleProps> = ({
  autoplayEnabled,
  onToggle,
  size = 28,
  disabled = false,
  opacity = 1,
}) => {
  // Animation values
  const scaleAnim = useRef(new RN.Animated.Value(1)).current;
  const glowAnim = useRef(new RN.Animated.Value(0)).current;
  const pulseAnim = useRef(new RN.Animated.Value(0)).current;
  
  // State for hover (web only)
  const [isHovered, setIsHovered] = React.useState(false);

  // Pulse animation for ON state (continuous blue ring pulse)
  useEffect(() => {
    if (autoplayEnabled && !disabled) {
      const pulseAnimation = RN.Animated.loop(
        RN.Animated.sequence([
          RN.Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: RN.Easing.inOut(RN.Easing.ease),
            useNativeDriver: true,
          }),
          RN.Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            easing: RN.Easing.inOut(RN.Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [autoplayEnabled, disabled, pulseAnim]);

  // Handle press with animation
  const handlePress = () => {
    if (disabled) return;

    // Scale animation on press
    RN.Animated.sequence([
      RN.Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        easing: RN.Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      RN.Animated.timing(scaleAnim, {
        toValue: 1.02,
        duration: 150,
        easing: RN.Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      RN.Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        easing: RN.Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();

    onToggle();
  };

  // Handle hover effects
  const handleHoverIn = () => {
    if (disabled) return;
    setIsHovered(true);
    RN.Animated.timing(glowAnim, {
      toValue: 1,
      duration: 200,
      easing: RN.Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  };

  const handleHoverOut = () => {
    setIsHovered(false);
    RN.Animated.timing(glowAnim, {
      toValue: 0,
      duration: 200,
      easing: RN.Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  };

  // Interpolated values
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, autoplayEnabled ? 0.4 : 0.1],
  });

  // Colors based on state
  const backgroundColor = disabled
    ? "#2A2A2A"
    : autoplayEnabled
    ? "#0F0F0F"
    : "#0F0F0F";

  const iconColor = disabled
    ? "#7A7A7A"
    : autoplayEnabled
    ? "#FFFFFF"
    : "#7A7A7A";

  const glowColor = autoplayEnabled ? "#3EA6FF" : "#FFFFFF";

  const icon = autoplayEnabled ? "play" : "pause";

  const tooltipText = autoplayEnabled ? "Autoplay is on" : "Autoplay is off";

  // Web-specific hover handlers
  const webHoverProps = RN.Platform.OS === "web" ? {
    onMouseEnter: handleHoverIn,
    onMouseLeave: handleHoverOut,
  } : {};

  return (
    <RN.Animated.View style={[styles.container, { opacity }]}>
      <RN.Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.pressable,
          pressed && !disabled && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={tooltipText}
        accessibilityState={{ checked: autoplayEnabled, disabled }}
        disabled={disabled}
        {...webHoverProps}
      >
        <RN.Animated.View
          style={[
            styles.buttonContainer,
            {
              width: size + 8,
              height: size + 8,
              borderRadius: (size + 8) / 2,
              backgroundColor,
              transform: [{ scale: scaleAnim }],
            },
            disabled && styles.disabled,
          ]}
        >
          {/* Pulse ring for ON state */}
          {autoplayEnabled && !disabled && (
            <RN.Animated.View
              style={[
                styles.pulseRing,
                {
                  width: size + 8,
                  height: size + 8,
                  borderRadius: (size + 8) / 2,
                  borderWidth: 2,
                  borderColor: glowColor,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
          )}

          {/* Hover glow effect */}
          <RN.Animated.View
            style={[
              styles.glowRing,
              {
                width: size + 16,
                height: size + 16,
                borderRadius: (size + 16) / 2,
                borderWidth: 2,
                borderColor: glowColor,
                opacity: glowOpacity,
              },
            ]}
          />

          {/* Icon */}
          <RN.View style={styles.iconWrapper}>
            <IconButton
              icon={icon}
              size={size * 0.6}
              iconColor={iconColor}
              style={styles.iconButton}
            />
          </RN.View>
        </RN.Animated.View>

        {/* Tooltip (web only) */}
        {RN.Platform.OS === "web" && isHovered && !disabled && (
          <RN.View style={styles.tooltip}>
            <RN.Text style={styles.tooltipText}>{tooltipText}</RN.Text>
          </RN.View>
        )}
      </RN.Pressable>
    </RN.Animated.View>
  );
};

const styles = RN.StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  pressable: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
  },
  pressed: {
    opacity: 0.9,
  },
  buttonContainer: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    // Shadow for depth (YouTube 2025 style)
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
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
      },
    }),
  },
  disabled: {
    opacity: 0.5,
  },
  pulseRing: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  glowRing: {
    position: "absolute",
    top: -8,
    left: -8,
  },
  iconWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  iconButton: {
    margin: 0,
  },
  tooltip: {
    position: "absolute",
    bottom: -32,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 100,
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
    textAlign: "center",
  },
});

export default React.memo(AutoplayToggle);

