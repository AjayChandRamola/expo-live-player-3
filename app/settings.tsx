// app/settings.tsx
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from "react-native";
import { Pressable } from "react-native";
import { Stack } from "expo-router";
import Constants from "expo-constants";
import { getColors, tokens } from "../constants/tokens";
import { useSettings } from "../contexts/SettingsContext";
import { usePlayQueue } from "../contexts/PlayQueueContext";
import type { ThemePreference } from "../services/storage/settingsStorage";

const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);
  const { theme, autoplayDefault, setTheme, setAutoplayDefault } = useSettings();
  const { setAutoplay } = usePlayQueue();

  const handleAutoplayChange = useCallback(
    (value: boolean) => {
      setAutoplayDefault(value);
      setAutoplay(value);
    },
    [setAutoplayDefault, setAutoplay],
  );

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Appearance</Text>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option.value;
            return (
              <Pressable
                key={option.value}
                testID={`theme-${option.value}`}
                onPress={() => setTheme(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                style={styles.row}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>{option.label}</Text>
                {selected ? (
                  <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Playback</Text>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Autoplay next video</Text>
            <Switch
              testID="autoplay-toggle"
              value={autoplayDefault}
              onValueChange={handleAutoplayChange}
              accessibilityLabel="Autoplay next video"
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>About</Text>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Version</Text>
            <Text testID="settings-version" style={[styles.rowValue, { color: colors.textMuted }]}>
              {Constants.expoConfig?.version ?? "—"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: tokens.spacing.lg },
  sectionTitle: {
    ...tokens.typography.caption,
    fontWeight: "600",
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  section: {
    borderRadius: tokens.radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    minHeight: tokens.touchTarget.min,
  },
  rowLabel: { ...tokens.typography.body },
  rowValue: { ...tokens.typography.body },
  checkmark: { ...tokens.typography.body, fontWeight: "700" },
});
