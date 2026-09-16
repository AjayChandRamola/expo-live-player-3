// components/VideoPlayer/ui/CaptionsView.tsx
import React, { memo, useMemo } from "react";
import { PixelRatio, StyleSheet, Text, View } from "react-native";
import type { CaptionItem } from "../../../types/domain";
import { CAPTION_FONT_SIZE } from "../constants";
import { selectCue } from "../engine/pure/selectCue";
import { playerTokens } from "../tokens";

interface Props {
  readonly captions: readonly CaptionItem[];
  readonly positionMs: number;
  readonly testID?: string;
}

export const CaptionsView = memo(function CaptionsView({ captions, positionMs, testID }: Props) {
  const cue = useMemo(() => selectCue(captions, positionMs), [captions, positionMs]);
  if (!cue) return null;
  return (
    <View style={styles.container} pointerEvents="none" accessibilityLiveRegion="polite" testID={testID}>
      <Text style={[styles.text, { fontSize: CAPTION_FONT_SIZE * PixelRatio.getFontScale() }]}>{cue.text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: playerTokens.size.bottomRowHeight + playerTokens.space.sm,
    alignItems: "center",
  },
  text: {
    maxWidth: "90%",
    textAlign: "center",
    color: playerTokens.color.captionText,
    backgroundColor: playerTokens.color.captionBackground,
    paddingHorizontal: playerTokens.space.sm,
    paddingVertical: playerTokens.space.xs,
    borderRadius: playerTokens.radius.sm,
  },
});
