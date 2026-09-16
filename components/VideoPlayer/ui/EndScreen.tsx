// components/VideoPlayer/ui/EndScreen.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { playerTokens } from "../tokens";
import { ControlButton } from "./controls/ControlButton";

interface Props {
  readonly visible: boolean;
  readonly secondsLeft: number | null;
  readonly onReplay: () => void;
  readonly onCancelAutoplay: () => void;
  readonly testID?: string;
}

export function EndScreen({ visible, secondsLeft, onReplay, onCancelAutoplay, testID }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.container} testID={testID}>
      <ControlButton icon="replay" accessibilityLabel="Replay" onPress={onReplay} size="lg" />
      {secondsLeft !== null ? (
        <View style={styles.upNext}>
          <Text style={styles.text} accessibilityLiveRegion="polite">{`Up next in ${secondsLeft}`}</Text>
          <Pressable onPress={onCancelAutoplay} accessibilityRole="button" accessibilityLabel="Cancel autoplay" style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: playerTokens.z.overlay },
  upNext: { marginTop: playerTokens.space.lg, alignItems: "center" },
  text: { color: playerTokens.color.onVideo },
  cancel: { marginTop: playerTokens.space.sm, minHeight: playerTokens.size.minTouchTarget, justifyContent: "center", paddingHorizontal: playerTokens.space.lg },
  cancelText: { color: playerTokens.color.onVideo, textDecorationLine: "underline" },
});
