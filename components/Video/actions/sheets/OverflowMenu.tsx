// components/Video/actions/sheets/OverflowMenu.tsx
// Trimmed to actions with a real implementation (ADR 0006/0007). Help,
// Quality and Captions were removed — no verified implementation.
import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly videoId: string;
  readonly channelId?: string;
  readonly onNotInterested: () => void;
  readonly onReport: () => void;
  readonly onDontRecommendChannel: () => void;
}

interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
}

export function OverflowMenu({ visible, onClose, onNotInterested, onReport, onDontRecommendChannel }: Props) {
  const menuItems: MenuItem[] = [
    { id: "not-interested", label: "Not interested", icon: "close-circle-outline", onPress: onNotInterested },
    { id: "report", label: "Report", icon: "flag-outline", onPress: onReport, danger: true },
    { id: "dont-recommend-channel", label: "Don't recommend channel", icon: "account-cancel-outline", onPress: onDontRecommendChannel, danger: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
              <MaterialCommunityIcons name={item.icon as never} size={24} color={item.danger ? "#FF0000" : "#000000"} />
              <Text style={[styles.menuItemText, item.danger && styles.menuItemTextDanger]}>{item.label}</Text>
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
  menuItemDanger: {},
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
