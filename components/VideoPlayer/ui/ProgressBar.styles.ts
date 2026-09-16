// components/VideoPlayer/ui/ProgressBar.styles.ts
import { StyleSheet } from "react-native";
import { playerTokens } from "../tokens";

export const styles = StyleSheet.create({
  container: { width: "100%" },
  hitArea: { height: playerTokens.size.minTouchTarget, justifyContent: "center" },
  track: { height: playerTokens.size.progressBar, backgroundColor: playerTokens.color.track, borderRadius: playerTokens.size.progressBar / 2 },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: playerTokens.size.progressBar / 2 },
  buffered: { backgroundColor: playerTokens.color.buffered },
  played: { backgroundColor: playerTokens.color.accent },
  chapterTick: {
    position: "absolute",
    top: -playerTokens.space.xs / 2,
    width: 2,
    height: playerTokens.size.progressBar + playerTokens.space.xs,
    backgroundColor: playerTokens.color.chapterTick,
  },
  thumb: {
    position: "absolute",
    top: (playerTokens.size.progressBar - playerTokens.size.thumb) / 2,
    marginLeft: -playerTokens.size.thumb / 2,
    width: playerTokens.size.thumb,
    height: playerTokens.size.thumb,
    borderRadius: playerTokens.size.thumb / 2,
    backgroundColor: playerTokens.color.accent,
  },
  preview: {
    position: "absolute",
    bottom: playerTokens.size.minTouchTarget,
    marginLeft: -playerTokens.space.xl,
    paddingHorizontal: playerTokens.space.sm,
    paddingVertical: playerTokens.space.xs,
    borderRadius: playerTokens.radius.sm,
    backgroundColor: playerTokens.color.surface,
  },
  previewText: { color: playerTokens.color.onVideo, fontVariant: ["tabular-nums"] },
});
