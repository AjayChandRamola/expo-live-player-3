// components/ui/Skeleton.tsx
import React from "react";
import { useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";

export interface SkeletonProps {
  readonly width?: number | `${number}%`;
  readonly height?: number;
  readonly testID?: string;
}

export function Skeleton({ width = "100%", height = 16, testID }: SkeletonProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <View
      testID={testID}
      style={{
        width,
        height,
        backgroundColor: colors.skeleton,
        borderRadius: tokens.radius.sm,
      }}
    />
  );
}
