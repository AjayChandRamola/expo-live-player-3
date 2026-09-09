/**
 * components/VideoPlayer/modals/VideoOverflowMenu.tsx
 * 
 * YouTube-style overflow menu
 * - Not Interested
 * - Report
 * - Don't recommend channel
 * - Help & Feedback
 * - Quality settings (placeholder)
 * - Captions settings (placeholder)
 * 
 * Production-ready, accessible
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Logger from "../../../utils/Logger";

interface VideoOverflowMenuProps {
  /**
   * Video ID
   */
  videoId: string;

  /**
   * Channel ID
   */
  channelId?: string;

  /**
   * Whether modal is visible
   */
  visible: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Callbacks
   */
  onNotInterested?: () => void;
  onReport?: () => void;
  onDontRecommendChannel?: () => void;
  onHelp?: () => void;
  onQuality?: () => void;
  onCaptions?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
}

/**
 * VideoOverflowMenu Component
 */
export function VideoOverflowMenu({
  videoId,
  channelId,
  visible,
  onClose,
  onNotInterested,
  onReport,
  onDontRecommendChannel,
  onHelp,
  onQuality,
  onCaptions,
}: VideoOverflowMenuProps) {
  /**
   * Handle not interested
   */
  const handleNotInterested = useCallback(() => {
    Alert.alert(
      "Not Interested",
      "We'll stop showing you videos like this. This won't affect your recommendations right away.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Not Interested",
          style: "default",
          onPress: () => {
            onNotInterested?.();
            Logger.info("[VideoOverflowMenu] Not interested", { videoId });
            onClose();
          },
        },
      ]
    );
  }, [videoId, onNotInterested, onClose]);

  /**
   * Handle report
   */
  const handleReport = useCallback(() => {
    Alert.alert(
      "Report Video",
      "Why are you reporting this video?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Inappropriate",
          onPress: () => {
            onReport?.();
            Logger.info("[VideoOverflowMenu] Video reported", { videoId, reason: "inappropriate" });
            Alert.alert("Reported", "Thank you for your report. We'll review it soon.");
            onClose();
          },
        },
        {
          text: "Spam",
          onPress: () => {
            onReport?.();
            Logger.info("[VideoOverflowMenu] Video reported", { videoId, reason: "spam" });
            Alert.alert("Reported", "Thank you for your report. We'll review it soon.");
            onClose();
        },
        },
        {
          text: "Other",
          onPress: () => {
            onReport?.();
            Logger.info("[VideoOverflowMenu] Video reported", { videoId, reason: "other" });
            Alert.alert("Reported", "Thank you for your report. We'll review it soon.");
            onClose();
          },
        },
      ]
    );
  }, [videoId, onReport, onClose]);

  /**
   * Handle don't recommend channel
   */
  const handleDontRecommendChannel = useCallback(() => {
    if (!channelId) return;

    Alert.alert(
      "Don't Recommend Channel",
      "We'll stop showing you videos from this channel. You can still find them by searching.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Don't Recommend",
          style: "default",
          onPress: () => {
            onDontRecommendChannel?.();
            Logger.info("[VideoOverflowMenu] Don't recommend channel", { channelId });
            Alert.alert("Done", "We'll stop showing videos from this channel.");
            onClose();
          },
        },
      ]
    );
  }, [channelId, onDontRecommendChannel, onClose]);

  /**
   * Handle help
   */
  const handleHelp = useCallback(() => {
    onHelp?.();
    Logger.info("[VideoOverflowMenu] Help opened", { videoId });
    onClose();
  }, [videoId, onHelp, onClose]);

  /**
   * Handle quality
   */
  const handleQuality = useCallback(() => {
    Alert.alert("Quality Settings", "Quality settings coming soon!");
    onQuality?.();
    Logger.info("[VideoOverflowMenu] Quality settings opened", { videoId });
  }, [videoId, onQuality]);

  /**
   * Handle captions
   */
  const handleCaptions = useCallback(() => {
    Alert.alert("Caption Settings", "Caption settings coming soon!");
    onCaptions?.();
    Logger.info("[VideoOverflowMenu] Caption settings opened", { videoId });
  }, [videoId, onCaptions]);

  /**
   * Menu items
   */
  const menuItems: MenuItem[] = [
    {
      id: "not-interested",
      label: "Not Interested",
      icon: "close-circle-outline",
      onPress: handleNotInterested,
    },
    {
      id: "report",
      label: "Report",
      icon: "flag-outline",
      onPress: handleReport,
      danger: true,
    },
    {
      id: "dont-recommend-channel",
      label: "Don't recommend channel",
      icon: "account-cancel-outline",
      onPress: handleDontRecommendChannel,
      danger: true,
    },
    {
      id: "help",
      label: "Help & Feedback",
      icon: "help-circle-outline",
      onPress: handleHelp,
    },
    {
      id: "quality",
      label: "Quality",
      icon: "high-definition-box",
      onPress: handleQuality,
    },
    {
      id: "captions",
      label: "Captions",
      icon: "closed-caption",
      onPress: handleCaptions,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {menuItems.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.menuItem, item.danger && styles.menuItemDanger]}
              onPress={item.onPress}
              accessible
              accessibilityLabel={item.label}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name={item.icon as any}
                size={24}
                color={item.danger ? "#FF0000" : "#000000"}
              />
              <Text style={[styles.menuItemText, item.danger && styles.menuItemTextDanger]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 16,
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    minWidth: 200,
    paddingVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 200,
  },
  menuItemDanger: {
    // Danger items styled differently
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000000",
    flex: 1,
  },
  menuItemTextDanger: {
    color: "#FF0000",
  },
});

