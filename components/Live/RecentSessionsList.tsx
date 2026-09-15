// components/Live/RecentSessionsList.tsx
import React, { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";
import type { LiveSession } from "../../types/domain";

export interface RecentSessionsListProps {
  readonly sessions: readonly LiveSession[];
  readonly onSelect: (session: LiveSession) => void;
  readonly testID?: string;
}

export function RecentSessionsList({ sessions, onSelect, testID }: RecentSessionsListProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  const renderItem = useCallback(
    ({ item }: { item: LiveSession }) => (
      <Pressable
        testID={`${testID}-item-${item.id}`}
        onPress={() => onSelect(item)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
      </Pressable>
    ),
    [colors.text, onSelect, testID],
  );

  return (
    <FlatList
      testID={testID}
      data={sessions as LiveSession[]}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  title: { ...tokens.typography.body },
});
