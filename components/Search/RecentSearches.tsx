// components/Search/RecentSearches.tsx
import React from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";

export interface RecentSearchesProps {
  readonly queries: readonly string[];
  readonly onSelect: (query: string) => void;
  readonly onClear: () => void;
  readonly testID?: string;
}

export function RecentSearches({ queries, onSelect, onClear, testID }: RecentSearchesProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  if (queries.length === 0) return null;

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.textMuted }]}>Recent searches</Text>
        <Pressable
          testID="recent-clear"
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear recent searches"
        >
          <Text style={[styles.clear, { color: colors.primary }]}>Clear</Text>
        </Pressable>
      </View>
      {queries.map((query) => (
        <Pressable
          key={query}
          testID={`recent-${query}`}
          onPress={() => onSelect(query)}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`Search for ${query}`}
        >
          <Text style={[styles.query, { color: colors.text }]}>{query}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: tokens.spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.sm,
  },
  heading: { ...tokens.typography.caption, fontWeight: "600" },
  clear: { ...tokens.typography.caption, fontWeight: "600" },
  row: { paddingVertical: tokens.spacing.sm },
  query: { ...tokens.typography.body },
});
