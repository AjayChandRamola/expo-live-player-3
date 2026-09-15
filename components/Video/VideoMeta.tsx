// components/Video/VideoMeta.tsx
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";
import type { Video } from "../../types/domain";

export interface VideoMetaProps {
  readonly video: Video;
  readonly testID?: string;
}

function formatPublishedAt(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

export function VideoMeta({ video, testID }: VideoMetaProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);
  const [isExpanded, setIsExpanded] = useState(false);

  const publishedLabel = formatPublishedAt(video.publishedAt);
  const viewsLabel = video.viewCount !== undefined ? formatViewCount(video.viewCount) : undefined;
  const metaLine = [viewsLabel, publishedLabel].filter(Boolean).join(" · ");

  return (
    <View testID={testID} style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{video.title}</Text>
      <Text style={[styles.channel, { color: colors.textMuted }]}>{video.channel.name}</Text>
      {metaLine ? <Text style={[styles.metaLine, { color: colors.textMuted }]}>{metaLine}</Text> : null}
      {video.description ? (
        <View style={styles.descriptionBlock}>
          <Text
            testID={`${testID}-description`}
            style={[styles.description, { color: colors.text }]}
            numberOfLines={isExpanded ? undefined : 3}
          >
            {video.description}
          </Text>
          <Pressable
            testID={`${testID}-description-toggle`}
            onPress={() => setIsExpanded((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? "Show less" : "Show more"}
          >
            <Text style={[styles.toggle, { color: colors.primary }]}>
              {isExpanded ? "Show less" : "Show more"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  title: { ...tokens.typography.title },
  channel: { ...tokens.typography.body },
  metaLine: { ...tokens.typography.caption },
  descriptionBlock: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  description: { ...tokens.typography.body },
  toggle: { ...tokens.typography.caption, fontWeight: "600" },
});
