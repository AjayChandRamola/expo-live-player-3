// components/VideoPlayer/ui/TimeLabel.tsx
import React from "react";
import { StyleSheet, Text } from "react-native";
import { LIVE_EDGE_TOLERANCE_MS } from "../constants";
import { formatTime } from "../engine/pure/formatTime";
import { playerTokens } from "../tokens";

interface Props {
  readonly positionMs: number;
  readonly durationMs: number;
  readonly isLive: boolean;
  readonly liveOffsetMs: number | null;
  readonly chapterTitle: string | null;
  readonly testID?: string;
}

export function TimeLabel({ positionMs, durationMs, isLive, liveOffsetMs, chapterTitle, testID }: Props) {
  const time = isLive
    ? liveOffsetMs !== null && liveOffsetMs > LIVE_EDGE_TOLERANCE_MS
      ? `-${formatTime(liveOffsetMs)}`
      : "LIVE"
    : `${formatTime(positionMs)} / ${formatTime(durationMs)}`;
  return (
    <Text style={styles.text} numberOfLines={1} testID={testID}>
      {chapterTitle ? `${time} · ${chapterTitle}` : time}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { color: playerTokens.color.onVideo, fontVariant: ["tabular-nums"], flexShrink: 1 },
});
