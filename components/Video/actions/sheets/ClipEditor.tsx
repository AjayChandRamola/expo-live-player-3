// components/Video/actions/sheets/ClipEditor.tsx
// Clip creation UI wired to the repository (via onCreate). Spec: docs/player/07-app-actions-and-repositories.md
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LIMITS } from "../../../../constants/config";
import { makeError } from "../../../../services/appError";
import type { ClipRecord } from "../../../../services/videoActions/VideoActionsRepository";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly videoId: string;
  readonly durationMs: number;
  readonly currentPositionMs: number;
  readonly onCreate: (startMs: number, endMs: number) => Promise<ClipRecord | null>;
}

const formatTime = (ms: number): string => {
  if (!ms || Number.isNaN(ms)) return "0:00";
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor((total % 3600) / 60);
  const h = Math.floor(total / 3600);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
};

const VALIDATION_MESSAGE = makeError("validation").message;

export function ClipEditor({ visible, onClose, videoId, durationMs, currentPositionMs, onCreate }: Props) {
  const [startMs, setStartMs] = useState<number | null>(null);
  const [endMs, setEndMs] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clipDuration = startMs !== null && endMs !== null ? Math.max(0, endMs - startMs) : 0;

  const handleCancel = useCallback(() => {
    setStartMs(null);
    setEndMs(null);
    setError(null);
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    const length = startMs !== null && endMs !== null ? endMs - startMs : Number.NaN;
    const valid =
      startMs !== null &&
      endMs !== null &&
      startMs >= 0 &&
      endMs <= durationMs &&
      startMs < endMs &&
      length >= LIMITS.clipMinMs &&
      length <= LIMITS.clipMaxMs;
    if (!valid || startMs === null || endMs === null) {
      setError(VALIDATION_MESSAGE);
      return;
    }
    setIsSaving(true);
    setError(null);
    const clip = await onCreate(startMs, endMs);
    setIsSaving(false);
    if (clip) {
      setStartMs(null);
      setEndMs(null);
      onClose();
    } else {
      setError(VALIDATION_MESSAGE);
    }
  }, [startMs, endMs, durationMs, onCreate, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Clip</Text>
            <Pressable onPress={handleCancel} accessible accessibilityLabel="Close clip editor" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={24} color="#000000" />
            </Pressable>
          </View>

          <View style={styles.timeControls}>
            <View style={styles.timeControl}>
              <Text style={styles.timeLabel}>Start Time</Text>
              <Text style={styles.timeValue}>{startMs !== null ? formatTime(startMs) : "--:--"}</Text>
              <Pressable
                style={styles.setButton}
                onPress={() => setStartMs(currentPositionMs)}
                accessible
                accessibilityLabel="Set start"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="play-circle" size={20} color="#065FD4" />
                <Text style={styles.setButtonText}>Set</Text>
              </Pressable>
            </View>

            <View style={styles.timeControl}>
              <Text style={styles.timeLabel}>End Time</Text>
              <Text style={styles.timeValue}>{endMs !== null ? formatTime(endMs) : "--:--"}</Text>
              <Pressable
                style={styles.setButton}
                onPress={() => setEndMs(currentPositionMs)}
                accessible
                accessibilityLabel="Set end"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="play-circle" size={20} color="#065FD4" />
                <Text style={styles.setButtonText}>Set</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.durationContainer}>
            <Text style={styles.durationLabel}>Clip Duration:</Text>
            <Text style={styles.durationValue}>{formatTime(clipDuration)}</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={isSaving}
              accessible
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              accessible
              accessibilityLabel="Save clip"
              accessibilityRole="button"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save clip</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
  },
  timeControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 16,
  },
  timeControl: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 12,
    color: "#606060",
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  setButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
  },
  setButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#065FD4",
  },
  durationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    marginBottom: 20,
  },
  durationLabel: {
    fontSize: 14,
    color: "#606060",
  },
  durationValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#065FD4",
  },
  errorText: {
    fontSize: 14,
    color: "#B91C1C",
    marginBottom: 12,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: "#F0F0F0",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#606060",
  },
  saveButton: {
    backgroundColor: "#065FD4",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
