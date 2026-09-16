/**
 * components/VideoPlayer/modals/VideoSaveSheet.tsx
 *
 * Save toggle backed by SavedContext, the app's single source of truth for
 * saved videos. Playlists are out of MVP scope (HLD: Later).
 */

import React, { useCallback } from "react";
import { View, Text, Modal, StyleSheet, Pressable, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSaved } from "../../../contexts/SavedContext";

interface VideoSaveSheetProps {
  /**
   * Video ID
   */
  videoId: string;

  /**
   * Whether modal is visible
   */
  visible: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Callback when video is saved
   */
  onSaved?: (playlistIds: string[]) => void;
}

/**
 * VideoSaveSheet Component
 */
export function VideoSaveSheet({
  videoId,
  visible,
  onClose,
  onSaved,
}: VideoSaveSheetProps) {
  const { isSaved, toggleSave } = useSaved();
  const saved = isSaved(videoId);

  const handleToggle = useCallback(() => {
    toggleSave(videoId);
    onSaved?.([]);
    onClose();
  }, [videoId, toggleSave, onSaved, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Bookmark this video</Text>
            <Pressable onPress={onClose} accessible accessibilityLabel="Close save sheet" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={24} color="#000000" />
            </Pressable>
          </View>

          <Pressable
            testID="save-sheet-toggle"
            style={styles.saveButton}
            onPress={handleToggle}
            accessible
            accessibilityLabel={saved ? "Saved. Press to unsave" : "Save this video"}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.saveButtonText}>{saved ? "Saved" : "Save"}</Text>
          </Pressable>
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
  backdropTouchable: {
    flex: 1,
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
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
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
  },
  saveButton: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#065FD4",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
