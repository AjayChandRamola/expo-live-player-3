// components/ui/IconButton.tsx
import React from "react";
import { Pressable, StyleSheet, useColorScheme } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { getColors, tokens } from "../../constants/tokens";

export interface IconButtonProps {
  readonly icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
  readonly testID?: string;
  readonly size?: number;
}

export function IconButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
  testID,
  size = tokens.iconSize.md,
}: IconButtonProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.root}
    >
      <MaterialCommunityIcons
        name={icon}
        size={size}
        color={disabled ? colors.textMuted : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: tokens.touchTarget.min,
    minWidth: tokens.touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
  },
});
