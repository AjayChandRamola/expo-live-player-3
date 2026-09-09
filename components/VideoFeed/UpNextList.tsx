/**
 * components/VideoFeed/UpNextList.tsx
 * 
 * "Up Next" video list component (YouTube 2025 style)
 * - Shows upcoming videos in queue
 * - Highlights currently playing video
 * - Tap to instantly load and play
 * - Compact layout for below-player placement
 * 
 * Production-ready with accessibility and performance optimizations
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useColorScheme,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import type { VideoMetadata } from "../../types/video";

interface UpNextListProps {
  videos: VideoMetadata[];
  currentVideoId: string | null;
  onVideoPress: (video: VideoMetadata, index: number) => void;
  maxItems?: number;
}

/**
 * Format duration MM:SS
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Format view count
 */
const formatViews = (views: number): string => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

/**
 * Compact video item for "Up Next" list
 */
const UpNextItem: React.FC<{
  video: VideoMetadata;
  index: number;
  isPlaying: boolean;
  onPress: () => void;
  isDark: boolean;
}> = React.memo(({ video, index, isPlaying, onPress, isDark }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        isPlaying && styles.itemPlaying,
        isPlaying && { backgroundColor: isDark ? "rgba(14,165,255,0.15)" : "rgba(14,165,255,0.1)" },
        pressed && styles.itemPressed,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${isPlaying ? "Currently playing: " : ""}${video.title} by ${video.channelName}`}
      accessibilityHint="Tap to play this video"
    >
      {/* Thumbnail with duration */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          placeholder={require("../../assets/images/partial-react-logo.png")}
        />
        
        {/* Duration badge */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
        </View>

        {/* Playing indicator */}
        {isPlaying && (
          <View style={styles.playingOverlay}>
            <View style={styles.playingBadge}>
              <Text style={styles.playingText}>▶ NOW PLAYING</Text>
            </View>
          </View>
        )}

        {/* Queue number */}
        {!isPlaying && (
          <View style={styles.queueNumber}>
            <Text style={styles.queueNumberText}>{index + 1}</Text>
          </View>
        )}
      </View>

      {/* Video info */}
      <View style={styles.info}>
        <Text
          style={[styles.title, { color: isDark ? "#FFFFFF" : "#0F0F0F" }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {video.title}
        </Text>
        <Text
          style={[styles.metadata, { color: isDark ? "#AAAAAA" : "#606060" }]}
          numberOfLines={1}
        >
          {video.channelName}
        </Text>
        <Text
          style={[styles.metadata, { color: isDark ? "#AAAAAA" : "#606060" }]}
          numberOfLines={1}
        >
          {formatViews(video.views)} views
        </Text>
      </View>
    </Pressable>
  );
});

UpNextItem.displayName = "UpNextItem";

/**
 * UpNextList Component
 */
const UpNextList: React.FC<UpNextListProps> = ({
  videos,
  currentVideoId,
  onVideoPress,
  maxItems = 20,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const displayVideos = videos.slice(0, maxItems);

  const renderItem = useCallback(
    ({ item, index }: { item: VideoMetadata; index: number }) => (
      <UpNextItem
        video={item}
        index={index}
        isPlaying={item.id === currentVideoId}
        onPress={() => onVideoPress(item, index)}
        isDark={isDark}
      />
    ),
    [currentVideoId, onVideoPress, isDark]
  );

  const keyExtractor = useCallback((item: VideoMetadata) => `upnext-${item.id}`, []);

  if (displayVideos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: isDark ? "#FFFFFF" : "#0F0F0F" }]}>
          Up next
        </Text>
        <Text style={[styles.headerCount, { color: isDark ? "#AAAAAA" : "#606060" }]}>
          {displayVideos.length} videos
        </Text>
      </View>

      {/* Video list */}
      <FlatList
        data={displayVideos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        scrollEnabled={false}
        removeClippedSubviews={Platform.OS === "android"}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerCount: {
    fontSize: 13,
    fontWeight: "500",
  },
  item: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  itemPlaying: {
    borderLeftWidth: 3,
    borderLeftColor: "#0ea5ff",
  },
  itemPressed: {
    opacity: 0.7,
  },
  thumbnailContainer: {
    width: 168,
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
    marginRight: 12,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  playingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(14, 165, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  playingBadge: {
    backgroundColor: "#0ea5ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  playingText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  queueNumber: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  queueNumberText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  info: {
    flex: 1,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 4,
  },
  metadata: {
    fontSize: 12,
    marginBottom: 2,
  },
});

export default React.memo(UpNextList);

