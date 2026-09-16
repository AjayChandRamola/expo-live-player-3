// components/VideoPlayer/ui/MiniPlayer.tsx
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { PlaybackCommands, PlaybackStatus } from "../engine/types";
import { playerTokens } from "../tokens";
import { ControlButton } from "./controls/ControlButton";
import { PlayPauseButton } from "./controls/PlayPauseButton";

interface Props {
  readonly status: PlaybackStatus;
  readonly commands: PlaybackCommands;
  readonly onRestore: () => void;
  readonly onClose: () => void;
  readonly testID?: string;
}

export function MiniPlayer({ status, commands, onRestore, onClose, testID }: Props) {
  return (
    <View style={styles.overlay} testID={testID}>
      <Pressable style={styles.restoreArea} onPress={onRestore} accessibilityRole="button" accessibilityLabel="Restore player" />
      <View style={styles.column}>
        <PlayPauseButton status={status} commands={commands} size="sm" />
        <ControlButton icon="close" accessibilityLabel="Close mini player" onPress={onClose} size="sm" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row" },
  restoreArea: { flex: 1 },
  column: { justifyContent: "space-between", padding: playerTokens.space.xs },
});
