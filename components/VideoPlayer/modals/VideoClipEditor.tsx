/**
 * components/VideoPlayer/modals/VideoClipEditor.tsx
 * 
 * Clip editor modal for creating video clips
 * - Timeline with start/end markers
 * - Preview clip duration
 * - Save clip functionality
 * 
 * Production-ready, accessible
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Logger from "../../../utils/Logger";

interface VideoClipEditorProps {
  /**
   * Video ID
   */
  videoId: string;

  /**
   * Total video duration in milliseconds
   */
  duration: number;

  /**
   * Current playback position in milliseconds
   */
  currentPosition: number;

  /**
   * Whether modal is visible
   */
  visible: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Callback when clip is saved
   */
  onSave: (startTime: number, endTime: number) => Promise<void>;
}

/**
 * Format time for display
 */
const formatTime = (ms: number): string => {
  if (!ms || isNaN(ms)) return "0:00";
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor((total % 3600) / 60);
  const h = Math.floor(total / 3600);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
};

/**
 * VideoClipEditor Component
 */
export function VideoClipEditor({
  videoId,
  duration,
  currentPosition,
  visible,
  onClose,
  onSave,
}: VideoClipEditorProps) {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Calculate clip duration
   */
  const clipDuration = Math.max(0, endTime - startTime);

  /**
   * Handle set start time to current position
   */
  const handleSetStartTime = useCallback(() => {
    setStartTime(currentPosition);
    Logger.info("[VideoClipEditor] Start time set", { startTime: currentPosition });
  }, [currentPosition]);

  /**
   * Handle set end time to current position
   */
  const handleSetEndTime = useCallback(() => {
    setEndTime(currentPosition);
    Logger.info("[VideoClipEditor] End time set", { endTime: currentPosition });
  }, [currentPosition]);

  /**
   * Handle save clip
   */
  const handleSave = useCallback(async () => {
    if (startTime >= endTime) {
      Alert.alert("Invalid Clip", "Start time must be before end time.");
      return;
    }

    if (clipDuration < 5000) {
      Alert.alert("Clip Too Short", "Clip must be at least 5 seconds long.");
      return;
    }

    try {
      setIsSaving(true);
      Logger.info("[VideoClipEditor] Saving clip", {
        videoId,
        startTime,
        endTime,
        duration: clipDuration,
      });

      await onSave(startTime, endTime);

      Logger.info("[VideoClipEditor] Clip saved successfully", { videoId });
      Alert.alert("Clip Saved", "Your clip has been saved successfully!");
      onClose();
    } catch (error) {
      Logger.error("[VideoClipEditor] Failed to save clip:", error);
      Alert.alert("Error", "Failed to save clip. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [startTime, endTime, clipDuration, videoId, onSave, onClose]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    setStartTime(0);
    setEndTime(duration);
    onClose();
    Logger.info("[VideoClipEditor] Clip editor cancelled", { videoId });
  }, [duration, onClose, videoId]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Clip</Text>
            <Pressable onPress={handleCancel} accessible accessibilityLabel="Close clip editor" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={24} color="#000000" />
            </Pressable>
          </View>

          {/* Timeline Preview */}
          <View style={styles.timelineContainer}>
            <View style={styles.timelineTrack}>
              <View style={[styles.clipSegment, { left: `${(startTime / duration) * 100}%`, width: `${(clipDuration / duration) * 100}%` }]} />
            </View>
          </View>

          {/* Time Controls */}
          <View style={styles.timeControls}>
            <View style={styles.timeControl}>
              <Text style={styles.timeLabel}>Start Time</Text>
              <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
              <Pressable
                style={styles.setButton}
                onPress={handleSetStartTime}
                accessible
                accessibilityLabel={`Set start time to ${formatTime(currentPosition)}`}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="play-circle" size={20} color="#065FD4" />
                <Text style={styles.setButtonText}>Set</Text>
              </Pressable>
            </View>

            <View style={styles.timeControl}>
              <Text style={styles.timeLabel}>End Time</Text>
              <Text style={styles.timeValue}>{formatTime(endTime)}</Text>
              <Pressable
                style={styles.setButton}
                onPress={handleSetEndTime}
                accessible
                accessibilityLabel={`Set end time to ${formatTime(currentPosition)}`}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="play-circle" size={20} color="#065FD4" />
                <Text style={styles.setButtonText}>Set</Text>
              </Pressable>
            </View>
          </View>

          {/* Clip Duration */}
          <View style={styles.durationContainer}>
            <Text style={styles.durationLabel}>Clip Duration:</Text>
            <Text style={styles.durationValue}>{formatTime(clipDuration)}</Text>
          </View>

          {/* Action Buttons */}
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
              disabled={isSaving || clipDuration < 5000}
              accessible
              accessibilityLabel="Save clip"
              accessibilityRole="button"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Clip</Text>
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
    maxHeight: "80%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 16,
      },
    }),
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
  timelineContainer: {
    marginBottom: 24,
  },
  timelineTrack: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    position: "relative",
  },
  clipSegment: {
    position: "absolute",
    top: 0,
    height: 8,
    backgroundColor: "#065FD4",
    borderRadius: 4,
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

