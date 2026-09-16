// components/Live/LiveBadge.tsx
import React from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";

export interface LiveBadgeProps {
  readonly testID?: string;
}

export function LiveBadge({ testID }: LiveBadgeProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <View
      testID={testID}
      style={[styles.pill, { backgroundColor: colors.live }]}
      accessibilityLabel="Live now"
    >
      <Text style={styles.text}>LIVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radius.pill,
    alignSelf: "flex-start",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
