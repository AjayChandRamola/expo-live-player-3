// components/VideoPlayer/ui/controls/ControlButton.tsx
// The one pressable primitive for every player control. Spec: 06 §5.1
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { CONTROL_ICON_RATIO, CONTROL_PRESS_SCALE, PRESS_SPRING } from "../../constants";
import { playerTokens } from "../../tokens";

export type ControlSize = "sm" | "md" | "lg";
export type ControlIcon = keyof typeof MaterialCommunityIcons.glyphMap;

export interface ControlButtonProps {
  readonly icon: ControlIcon;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly size?: ControlSize;
  readonly disabled?: boolean;
  readonly active?: boolean;
  readonly testID?: string;
}

const SIZE_PX: Readonly<Record<ControlSize, number>> = {
  sm: playerTokens.size.controlSm,
  md: playerTokens.size.controlMd,
  lg: playerTokens.size.controlLg,
};

export const ControlButton = memo(function ControlButton({
  icon,
  accessibilityLabel,
  onPress,
  size = "md",
  disabled = false,
  active = false,
  testID,
}: ControlButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const px = SIZE_PX[size];
  const hitSlop = Math.max(0, (playerTokens.size.minTouchTarget - px) / 2);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(CONTROL_PRESS_SCALE, PRESS_SPRING);
  }, [scale]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      testID={testID}
      style={[styles.base, { width: px, height: px, borderRadius: px / 2 }, disabled && styles.disabled]}
    >
      <Animated.View style={animatedStyle}>
        <MaterialCommunityIcons name={icon} size={Math.round(px * CONTROL_ICON_RATIO)} color={playerTokens.color.onVideo} />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", backgroundColor: playerTokens.color.scrim },
  disabled: { opacity: playerTokens.opacity.disabled },
});
