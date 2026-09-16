// components/VideoPlayer/ui/controls/LiveBadge.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { playerTokens } from "../../tokens";

export function LiveBadge({ isLive, testID }: { readonly isLive: boolean; readonly testID?: string }) {
  if (!isLive) return null;
  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel="Live" testID={testID}>
      <View style={styles.dot} />
      <Text style={styles.text}>LIVE</Text>
    </View>
  );
}

const DOT = 8;
const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: playerTokens.space.sm,
    paddingVertical: playerTokens.space.xs,
    borderRadius: playerTokens.radius.sm,
    backgroundColor: playerTokens.color.scrim,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: playerTokens.color.live, marginRight: playerTokens.space.xs },
  text: { color: playerTokens.color.onVideo, fontWeight: "700", fontSize: playerTokens.space.md },
});
