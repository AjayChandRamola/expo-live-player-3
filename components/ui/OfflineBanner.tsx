// components/ui/OfflineBanner.tsx
import React from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";
import { useIsOnline } from "../../hooks/useIsOnline";

export interface OfflineBannerProps {
  readonly testID?: string;
}

export function OfflineBanner({ testID }: OfflineBannerProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);
  const { isOnline } = useIsOnline();

  if (isOnline) return null;

  return (
    <View
      testID={testID}
      style={[styles.bar, { backgroundColor: colors.danger }]}
      accessibilityRole="alert"
    >
      <Text style={styles.text}>You're offline. Some content may be unavailable.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    alignItems: "center",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
