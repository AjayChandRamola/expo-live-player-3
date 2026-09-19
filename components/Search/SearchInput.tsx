// components/Search/SearchInput.tsx
import React from "react";
import { Pressable, StyleSheet, TextInput, useColorScheme, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { getColors, tokens } from "../../constants/tokens";

export interface SearchInputProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSubmit: () => void;
  readonly testID?: string;
}

export function SearchInput({ value, onChangeText, onSubmit, testID }: SearchInputProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <MaterialCommunityIcons name="magnify" size={tokens.iconSize.md} color={colors.textMuted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        autoFocus
        returnKeyType="search"
        placeholder="Search Yagna videos"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text }]}
        accessibilityLabel="Search Yagna videos"
      />
      {value.length > 0 ? (
        <Pressable
          testID={`${testID}-clear`}
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <MaterialCommunityIcons name="close" size={tokens.iconSize.sm} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    margin: tokens.spacing.md,
  },
  input: {
    flex: 1,
    ...tokens.typography.body,
    minHeight: tokens.touchTarget.min,
  },
});
