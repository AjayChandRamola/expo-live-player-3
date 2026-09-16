// components/VideoPlayer/ui/Toast.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { CONTROLS_FADE_MS } from "../constants";
import { playerTokens } from "../tokens";

interface Props {
  readonly message: string | null;
  readonly testID?: string;
}

export function Toast({ message, testID }: Props) {
  if (message === null) return null;
  return (
    <View style={styles.anchor} pointerEvents="none">
      <Animated.View entering={FadeIn.duration(CONTROLS_FADE_MS)} exiting={FadeOut.duration(CONTROLS_FADE_MS)} style={styles.toast} accessibilityLiveRegion="polite" testID={testID}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", top: playerTokens.size.minTouchTarget + playerTokens.space.lg, left: 0, right: 0, alignItems: "center", zIndex: playerTokens.z.toast },
  toast: { paddingHorizontal: playerTokens.space.lg, paddingVertical: playerTokens.space.sm, borderRadius: playerTokens.radius.pill, backgroundColor: playerTokens.color.surface },
  text: { color: playerTokens.color.onVideo },
});
