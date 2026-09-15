// components/Live/LiveEndedOverlay.tsx
import React from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";

export interface LiveEndedOverlayProps {
  readonly replayVideoId?: string;
  readonly onWatchReplay: (videoId: string) => void;
  readonly testID?: string;
}

export function LiveEndedOverlay({ replayVideoId, onWatchReplay, testID }: LiveEndedOverlayProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <View testID={testID} style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>This live session has ended</Text>
      {replayVideoId ? (
        <Pressable
          testID={`${testID}-replay`}
          onPress={() => onWatchReplay(replayVideoId)}
          accessibilityRole="button"
          accessibilityLabel="Watch replay"
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Watch replay</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  title: { ...tokens.typography.body, textAlign: "center" },
  button: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    minHeight: tokens.touchTarget.min,
    justifyContent: "center",
  },
  buttonText: { ...tokens.typography.body, fontWeight: "600" },
});
