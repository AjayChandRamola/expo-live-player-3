// components/Home/SectionHeader.tsx
import React from "react";
import { Text, useColorScheme } from "react-native";
import { getColors, tokens } from "../../constants/tokens";

export interface SectionHeaderProps {
  readonly title: string;
  readonly testID?: string;
}

export function SectionHeader({ title, testID }: SectionHeaderProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <Text
      testID={testID}
      style={{
        ...tokens.typography.heading,
        color: colors.text,
        paddingHorizontal: tokens.spacing.lg,
        paddingVertical: tokens.spacing.sm,
      }}
    >
      {title}
    </Text>
  );
}
