// -----------------------------------------------------------------------------
// File: app/settings.tsx
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useThemeColors, Colors } from "../constants/theme";
import Logger from "../utils/Logger";

export default function SettingsScreen() {
  const systemTheme = useThemeColors(); // current system theme
  const [useDark, setUseDark] = useState(systemTheme.background === "#151718");

  // manually pick theme
  const theme = useDark ? Colors.dark : Colors.light;

  useEffect(() => {
    Logger.info("[UI] SettingsScreen mounted");
    return () => Logger.info("[UI] SettingsScreen unmounted");
  }, []);

  const toggleTheme = () => {
    setUseDark((prev) => !prev);
    Logger.info(`[UI] Theme toggled → ${!useDark ? "Dark Mode" : "Light Mode"}`);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* Title */}
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      {/* Section: Theme Info */}
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.icon }]}>Current Theme</Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {useDark ? "Dark Mode" : "Light Mode"}
        </Text>
      </View>

      {/* Button: Toggle Theme */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.button, { backgroundColor: theme.tint }]}
        onPress={toggleTheme}
      >
        <Text style={[styles.buttonText, { color: theme.background }]}>
          Switch to {useDark ? "Light" : "Dark"} Mode
        </Text>
      </TouchableOpacity>

      {/* Example Action */}
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.button, { backgroundColor: theme.tint }]}
        onPress={() => Logger.info("[UI] Example button pressed")}
      >
        <Text style={[styles.buttonText, { color: theme.background }]}>Check for Updates</Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text style={[styles.footer, { color: theme.icon }]}>
        Built with Expo Router & Dynamic Theme Support
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 40,
  },
});
