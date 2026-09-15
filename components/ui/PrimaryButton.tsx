// components/ui/PrimaryButton.tsx
import React from "react";
import { Pressable, StyleSheet, Text, useColorScheme } from "react-native";
import { getColors, tokens } from "../../constants/tokens";

export interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  testID,
}: PrimaryButtonProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.root,
        { backgroundColor: disabled ? colors.border : colors.primary },
      ]}
    >
      <Text style={{ color: colors.onPrimary, ...tokens.typography.body }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: tokens.touchTarget.min,
    minWidth: tokens.touchTarget.min,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
