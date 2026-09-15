// components/Live/LiveNowBanner.tsx
import React from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";
import { LiveBadge } from "./LiveBadge";
import type { LiveStatus } from "../../types/domain";

export interface LiveNowBannerProps {
  readonly status: LiveStatus;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function LiveNowBanner({ status, onPress, testID }: LiveNowBannerProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  if (status.state === "none" || !status.session) return null;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`${status.session.title}${status.state === "live" ? ", live now" : ""}`}
    >
      {status.state === "live" ? <LiveBadge testID={`${testID}-badge`} /> : null}
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {status.session.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  textBlock: { flex: 1 },
  title: { ...tokens.typography.body, fontWeight: "600" },
});
