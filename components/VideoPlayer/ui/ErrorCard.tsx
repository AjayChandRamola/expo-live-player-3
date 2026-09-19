// components/VideoPlayer/ui/ErrorCard.tsx
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MAX_RETRIES } from "../constants";
import type { PlaybackError } from "../engine/types";
import { playerTokens } from "../tokens";

interface Props {
  readonly error: PlaybackError | null;
  readonly retryAttempt: number;
  readonly retrying: boolean;
  readonly onRetry: () => void;
  readonly testID?: string;
}

export function ErrorCard({ error, retryAttempt, retrying, onRetry, testID }: Props) {
  if (!error) return null;
  const showRetrying = retrying && retryAttempt > 0 && error.retryable;
  const showButton = !showRetrying && error.retryable;
  return (
    <View style={styles.backdrop} accessibilityLiveRegion="assertive" testID={testID}>
      <View style={styles.card}>
        <MaterialCommunityIcons name="alert-circle-outline" size={playerTokens.size.controlSm} color={playerTokens.color.onVideo} />
        <Text style={styles.message}>{error.message}</Text>
        {showRetrying ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={playerTokens.color.onVideo} />
            <Text style={styles.retrying}>{`Retrying (${retryAttempt}/${MAX_RETRIES})…`}</Text>
          </View>
        ) : null}
        {showButton ? (
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry" style={styles.button}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: playerTokens.z.overlay },
  card: { maxWidth: "80%", alignItems: "center", padding: playerTokens.space.xl, borderRadius: playerTokens.radius.md, backgroundColor: playerTokens.color.surface },
  message: { color: playerTokens.color.onVideo, textAlign: "center", marginTop: playerTokens.space.sm },
  row: { flexDirection: "row", alignItems: "center", marginTop: playerTokens.space.md },
  retrying: { color: playerTokens.color.onVideo, marginLeft: playerTokens.space.sm },
  button: { marginTop: playerTokens.space.lg, minHeight: playerTokens.size.minTouchTarget, justifyContent: "center", paddingHorizontal: playerTokens.space.xl, borderRadius: playerTokens.radius.pill, backgroundColor: playerTokens.color.accent },
  buttonText: { color: playerTokens.color.onVideo, fontWeight: "600" },
});
