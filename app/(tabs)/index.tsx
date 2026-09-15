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
import { LiveNowBanner } from "../../components/Live/LiveNowBanner";
import { usePlayQueue } from "../../contexts/PlayQueueContext";
import { useHomeContent } from "../../hooks/useHomeContent";
import { useLiveStatus } from "../../hooks/useLiveStatus";
import { toVideoMetadata } from "../../services/videoMetadataAdapter";
import type { Video } from "../../types/domain";
import type { VideoMetadata } from "../../types/video";

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  const { setQueue } = usePlayQueue();
  const { status, data, error, retry } = useHomeContent();
  const liveStatus = useLiveStatus({ enabled: true });

  const latestMetadata = useMemo(
    () => (data?.latest ?? []).map(toVideoMetadata),
    [data?.latest],
  );

  const handleVideoPress = useCallback(
    (video: VideoMetadata) => {
      setQueue(data?.latest ?? [], video.id);
      router.push(`/video/${encodeURIComponent(video.id)}`);
    },
    [router, setQueue, data?.latest],
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

      {liveStatus.data ? (
        <LiveNowBanner
          status={liveStatus.data}
          onPress={() => router.push("/live")}
          testID="home-live-banner"
        />
      ) : null}

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
