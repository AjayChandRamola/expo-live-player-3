// app/(tabs)/index.tsx
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import { VideoFeed } from "../../components/VideoFeed";
import { FeaturedYagnaCard } from "../../components/Home/FeaturedYagnaCard";
import { SectionHeader } from "../../components/Home/SectionHeader";
import { Screen } from "../../components/ui/Screen";
import { StateView } from "../../components/ui/StateView";
import { IconButton } from "../../components/ui/IconButton";
import { getColors, tokens } from "../../constants/tokens";
// TODO(Increment 3): replace with usePlayQueue() once PlayQueueContext exists.
import { useVideoPlayerContext } from "../../contexts/VideoPlayerContext";
import { useHomeContent } from "../../hooks/useHomeContent";
import type { Video } from "../../types/domain";
import type { VideoMetadata } from "../../types/video";

/**
 * Temporary bridge: VideoFeed (and its VideoCard children) still expect the
 * legacy VideoMetadata shape. Increment 3 migrates VideoFeed to the domain
 * Video type and this adapter is deleted.
 */
function toVideoMetadata(video: Video): VideoMetadata {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    videoUrl: video.source.url,
    duration: video.durationSec,
    views: video.viewCount ?? 0,
    uploadedAt: video.publishedAt,
    channelName: video.channel.name,
    channelAvatar: video.channel.avatarUrl,
    channelId: video.channel.id,
    tags: video.tags ? [...video.tags] : undefined,
    captions: video.captions ? [...video.captions] : undefined,
    chapters: video.chapters ? [...video.chapters] : undefined,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  const { setVideoList } = useVideoPlayerContext();
  const { status, data, error, retry } = useHomeContent();

  const latestMetadata = useMemo(
    () => (data?.latest ?? []).map(toVideoMetadata),
    [data?.latest],
  );

  const handleVideoPress = useCallback(
    (video: VideoMetadata) => {
      setVideoList(latestMetadata);
      router.push(`/video/${encodeURIComponent(video.id)}`);
    },
    [router, setVideoList, latestMetadata],
  );

  const handleFeaturedPress = useCallback(
    (video: Video) => {
      router.push(`/video/${encodeURIComponent(video.id)}`);
    },
    [router],
  );

  return (
    <Screen testID="home-screen">
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Yagna Vishnu Bhagwan</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Divya Darshan</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            testID="home-search-button"
            icon="magnify"
            accessibilityLabel="Search"
            onPress={() => router.push("/search")}
          />
          <IconButton
            testID="home-settings-button"
            icon="cog-outline"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
          />
        </View>
      </View>

      <StateView status={status} error={error} onRetry={retry} testID="home-state" />

      {status === "success" ? (
        <>
          {data?.featured ? (
            <>
              <SectionHeader title="Featured Yagna" />
              <FeaturedYagnaCard
                testID="home-featured"
                video={data.featured}
                onPress={handleFeaturedPress}
              />
            </>
          ) : null}

          <SectionHeader title="Latest" />
          <VideoFeed
            key="video-feed"
            initialVideos={latestMetadata}
            pageSize={10}
            variant="auto"
            onVideoPress={handleVideoPress}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: Platform.OS === "ios" ? tokens.spacing.sm : tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  headerTitle: { ...tokens.typography.heading, marginBottom: 2 },
  headerSubtitle: tokens.typography.caption,
  headerActions: { flexDirection: "row", gap: tokens.spacing.sm },
});
