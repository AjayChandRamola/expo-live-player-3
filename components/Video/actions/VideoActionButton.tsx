/**
 * components/VideoPlayer/VideoActionButton.tsx
 * 
 * Individual action button component
 * - Pilled button with icon and label
 * - Active/inactive states
 * - Scale animation on press
 * - Haptic feedback
 * 
 * Production-ready, accessible, performant
 */

import React, { memo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

interface VideoActionButtonProps {
  /**
   * Icon name (MaterialCommunityIcons)
   */
  icon: string;

  /**
   * Button label
   */
  label: string;

  /**
   * Whether button is active
   */
  active?: boolean;

  /**
   * Press handler
   */
  onPress: () => void;

  /**
   * Accessibility label
   */
  accessibilityLabel?: string;
}

/**
 * VideoActionButton Component
 */
export const VideoActionButton = memo(function VideoActionButton({
  icon,
  label,
  active = false,
  onPress,
  accessibilityLabel,
}: VideoActionButtonProps) {
  const scale = useSharedValue(1);

  /**
   * Animated style for scale
   */
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  /**
   * Handle press
   */
  const handlePress = useCallback(() => {
    // Scale animation
    scale.value = withSpring(0.95, { damping: 10, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    });

    // Haptic feedback (mobile only)
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Ignore haptic errors
      });
    }

    onPress();
  }, [onPress, scale]);

  /**
   * Handle press in
   */
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 10, stiffness: 300 });
  }, [scale]);

  /**
   * Handle press out
   */
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  }, [scale]);

  const iconColor = active ? "#FF0000" : "#606060"; // YouTube-red when active, gray when inactive
  const labelColor = active ? "#FF0000" : "#606060";

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          active && styles.buttonActive,
          pressed && styles.buttonPressed,
        ]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ selected: active }}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={iconColor}
          style={styles.icon}
        />
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "transparent", // YouTube-style transparent background
    minWidth: 80,
    justifyContent: "center",
  },
  buttonActive: {
    backgroundColor: "transparent", // No background change on active (YouTube style)
  },
  buttonPressed: {
    opacity: 0.7,
  },
  icon: {
    marginRight: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});

