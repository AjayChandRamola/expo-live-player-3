// components/VideoPlayer/ui/BufferingIndicator.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BUFFERING_INDICATOR_DELAY_MS } from "../constants";
import type { PlaybackStatus } from "../engine/types";
import { playerTokens } from "../tokens";

interface Props {
  readonly status: PlaybackStatus;
  readonly testID?: string;
}

export function BufferingIndicator({ status, testID }: Props) {
  const waiting = status === "loading" || status === "buffering";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!waiting) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), BUFFERING_INDICATOR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (!visible) return null;
  return (
    <View style={styles.container} pointerEvents="none" testID={testID}>
      <ActivityIndicator size="large" color={playerTokens.color.onVideo} accessibilityLabel="Loading" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
