// components/VideoPlayer/ui/controls/GoLiveButton.tsx
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { LIVE_EDGE_TOLERANCE_MS } from "../../constants";
import type { PlaybackCommands } from "../../engine/types";
import { playerTokens } from "../../tokens";

interface Props {
  readonly isLive: boolean;
  readonly liveOffsetMs: number | null;
  readonly commands: PlaybackCommands;
  readonly testID?: string;
}

export function GoLiveButton({ isLive, liveOffsetMs, commands, testID }: Props) {
  if (!isLive || liveOffsetMs === null || liveOffsetMs <= LIVE_EDGE_TOLERANCE_MS) return null;
  return (
    <Pressable onPress={commands.goToLive} accessibilityRole="button" accessibilityLabel="Go live" style={styles.button} testID={testID}>
      <Text style={styles.text}>Go live</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: playerTokens.size.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: playerTokens.space.md,
    borderRadius: playerTokens.radius.pill,
    backgroundColor: playerTokens.color.live,
  },
  text: { color: playerTokens.color.onVideo, fontWeight: "600" },
});
