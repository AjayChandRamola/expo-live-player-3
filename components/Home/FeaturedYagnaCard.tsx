// components/Home/FeaturedYagnaCard.tsx
import React from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Image } from "expo-image";
import { getColors, tokens } from "../../constants/tokens";
import type { Video } from "../../types/domain";

export interface FeaturedYagnaCardProps {
  readonly video: Video;
  readonly onPress: (video: Video) => void;
  readonly testID?: string;
}

export function FeaturedYagnaCard({ video, onPress, testID }: FeaturedYagnaCardProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <Pressable
      testID={testID}
      onPress={() => onPress(video)}
      accessibilityRole="button"
      accessibilityLabel={`Play ${video.title}`}
      style={[styles.root, { backgroundColor: colors.surfaceElevated }, tokens.elevation.level1]}
    >
      <Image
        source={{ uri: video.thumbnailUrl }}
        style={styles.thumbnail}
        contentFit="cover"
      />
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={[styles.channel, { color: colors.textMuted }]} numberOfLines={1}>
          {video.channel.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
    marginHorizontal: tokens.spacing.lg,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#00000010",
  },
  textBlock: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  title: { ...tokens.typography.body, fontWeight: "600" },
  channel: tokens.typography.caption,
});
