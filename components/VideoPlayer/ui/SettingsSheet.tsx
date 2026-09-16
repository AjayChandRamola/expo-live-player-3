// components/VideoPlayer/ui/SettingsSheet.tsx
// Speed, captions, subtitle track, quality (read-only). Spec: 06 §5.11
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { PLAYBACK_RATES } from "../constants";
import type { SubtitleTrackInfo } from "../engine/types";
import { playerTokens } from "../tokens";

export interface SettingsSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly rate: number;
  readonly onRate: (rate: number) => void;
  readonly captionsAvailable: boolean;
  readonly captionsEnabled: boolean;
  readonly onToggleCaptions: (enabled: boolean) => void;
  readonly subtitleTracks: readonly SubtitleTrackInfo[];
  readonly activeSubtitle: SubtitleTrackInfo | null;
  readonly onSelectSubtitle: (track: SubtitleTrackInfo | null) => void;
  readonly activeQualityLabel: string | null;
  readonly testID?: string;
}

function Chip({ label, selected, onPress, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export function SettingsSheet({
  visible,
  onClose,
  rate,
  onRate,
  captionsAvailable,
  captionsEnabled,
  onToggleCaptions,
  subtitleTracks,
  activeSubtitle,
  onSelectSubtitle,
  activeQualityLabel,
  testID,
}: SettingsSheetProps) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" />
      <View style={styles.sheet}>
        <ScrollView>
          <Text style={styles.heading}>Speed</Text>
          <View style={styles.row}>
            {PLAYBACK_RATES.map((value) => (
              <Chip key={value} label={`${value}×`} selected={value === rate} onPress={() => onRate(value)} accessibilityLabel={`Speed ${value}×`} />
            ))}
          </View>
          {captionsAvailable ? (
            <View style={styles.switchRow}>
              <Text style={styles.heading}>Captions</Text>
              <Switch value={captionsEnabled} onValueChange={onToggleCaptions} accessibilityLabel="Captions" />
            </View>
          ) : null}
          {subtitleTracks.length > 0 ? (
            <>
              <Text style={styles.heading}>Subtitles</Text>
              <View style={styles.row}>
                <Chip label="Off" selected={activeSubtitle === null} onPress={() => onSelectSubtitle(null)} accessibilityLabel="Subtitles Off" />
                {subtitleTracks.map((track) => (
                  <Chip key={track.id} label={track.label} selected={activeSubtitle?.id === track.id} onPress={() => onSelectSubtitle(track)} accessibilityLabel={`Subtitles ${track.label}`} />
                ))}
              </View>
            </>
          ) : null}
          {activeQualityLabel !== null ? (
            <View style={styles.switchRow}>
              <Text style={styles.heading}>Quality</Text>
              <Text style={styles.value}>{activeQualityLabel}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: playerTokens.color.scrim },
  sheet: { backgroundColor: playerTokens.color.surface, padding: playerTokens.space.lg, borderTopLeftRadius: playerTokens.radius.lg, borderTopRightRadius: playerTokens.radius.lg },
  heading: { color: playerTokens.color.onVideo, fontWeight: "600", marginTop: playerTokens.space.md, marginBottom: playerTokens.space.sm },
  row: { flexDirection: "row", flexWrap: "wrap" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chip: { minHeight: playerTokens.size.minTouchTarget, justifyContent: "center", paddingHorizontal: playerTokens.space.md, marginRight: playerTokens.space.sm, marginBottom: playerTokens.space.sm, borderRadius: playerTokens.radius.pill, backgroundColor: playerTokens.color.track },
  chipSelected: { backgroundColor: playerTokens.color.accent },
  chipText: { color: playerTokens.color.onVideo },
  value: { color: playerTokens.color.onVideo, marginTop: playerTokens.space.md },
});
