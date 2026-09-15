// components/Saved/EmptySaved.tsx
import React from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";

export interface EmptySavedProps {
  readonly testID?: string;
}

export function EmptySaved({ testID }: EmptySavedProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <View testID={testID} style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Saved</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Videos you save will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  title: { ...tokens.typography.title },
  hint: { ...tokens.typography.body, textAlign: "center" },
});
