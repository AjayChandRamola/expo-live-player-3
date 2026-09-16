// components/VideoPlayer/ui/SwipeIndicator.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { playerTokens } from "../tokens";

export interface SwipeLevel {
  readonly kind: "brightness" | "volume";
  readonly level: number;
}

interface Props {
  readonly level: SwipeLevel | null;
  readonly testID?: string;
}

const PERCENT = 100;

export function SwipeIndicator({ level, testID }: Props) {
  if (!level) return null;
  const pct = Math.round(level.level * PERCENT);
  const label = `${level.kind === "brightness" ? "Brightness" : "Volume"} ${pct}%`;
  return (
    <View style={[styles.container, level.kind === "brightness" ? styles.left : styles.right]} pointerEvents="none" accessibilityLabel={label} testID={testID}>
      <View style={styles.bar}>
        <View style={[styles.fill, { height: `${pct}%` }]} testID={`${testID ?? "swipe"}-fill`} />
      </View>
      <MaterialCommunityIcons name={level.kind === "brightness" ? "brightness-6" : "volume-high"} size={playerTokens.size.controlSm} color={playerTokens.color.onVideo} />
    </View>
  );
}

const BAR_WIDTH = 6;
const styles = StyleSheet.create({
  container: { position: "absolute", top: 0, bottom: 0, justifyContent: "center", alignItems: "center", width: "33%" },
  left: { left: 0 },
  right: { right: 0 },
  bar: { width: BAR_WIDTH, height: playerTokens.size.swipeIndicatorHeight, borderRadius: BAR_WIDTH / 2, backgroundColor: playerTokens.color.track, justifyContent: "flex-end", overflow: "hidden", marginBottom: playerTokens.space.sm },
  fill: { width: "100%", backgroundColor: playerTokens.color.onVideo },
});
