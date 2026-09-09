/**
 * components/VideoFeed/VideoCard.tsx
 * 
 * YouTube 2025-style video card component
 * - Responsive thumbnail with duration badge
 * - Channel avatar, title, metadata
 * - Hover effects (web) and press feedback (mobile)
 * - Optimized with React.memo for performance
 * 
 * Dependencies: react, react-native, expo-image, expo-router
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  Platform,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { VideoMetadata } from "../../types/video";

interface VideoCardProps {
  video: VideoMetadata;
  variant?: "list" | "grid";
  onPress?: (video: VideoMetadata) => void;
  style?: ViewStyle;
}

/**
 * Format duration from seconds to MM:SS or HH:MM:SS
 */
const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Format view count (e.g., 1.2M, 450K, 1.2K)
 */
const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
};

/**
 * Format time ago from ISO date string
 */
const formatTimeAgo = (isoDate: string): string => {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
    return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
  } catch {
    return "";
  }
};

const VideoCard: React.FC<VideoCardProps> = ({ video, variant = "list", onPress, style }) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(video);
    } else {
      // Navigate to video screen
      router.push(`/video/${video.id}`);
    }
  }, [video, onPress, router]);

  // Web hover handlers
  const handleHoverIn = () => setIsHovered(true);
  const handleHoverOut = () => setIsHovered(false);

  const webHoverProps = Platform.OS === "web" ? {
    onMouseEnter: handleHoverIn,
    onMouseLeave: handleHoverOut,
  } : {};

  const containerStyle = [
    styles.container,
    variant === "grid" && styles.gridContainer,
    style,
  ];

  const thumbnailStyle = [
    styles.thumbnail,
    isHovered && Platform.OS === "web" && styles.thumbnailHovered,
  ];

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        containerStyle,
        pressed && styles.pressed,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Watch ${video.title} by ${video.channelName}`}
      accessibilityHint="Double tap to play video"
      {...webHoverProps}
    >
      {/* Thumbnail with duration badge */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={thumbnailStyle}
          contentFit="cover"
          transition={200}
          onLoadEnd={() => setImageLoaded(true)}
          placeholder={require("../../assets/images/partial-react-logo.png")}
          placeholderContentFit="contain"
          cachePolicy="memory-disk"
        />
        
        {/* Duration badge */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
        </View>

        {/* Loading overlay */}
        {!imageLoaded && (
          <View style={styles.loadingOverlay} />
        )}
      </View>

      {/* Metadata section */}
      <View style={styles.metadata}>
        {/* Channel avatar */}
        {video.channelAvatar && (
          <Image
            source={{ uri: video.channelAvatar }}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        )}

        {/* Text info */}
        <View style={styles.textInfo}>
          {/* Title */}
          <Text
            style={[styles.title, { color: isDark ? "#FFFFFF" : "#0F0F0F" }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {video.title}
          </Text>

          {/* Channel name */}
          <Text
            style={[styles.channelName, { color: isDark ? "#AAAAAA" : "#606060" }]}
            numberOfLines={1}
          >
            {video.channelName}
          </Text>

          {/* Views and time */}
          <Text
            style={[styles.metadata, { color: isDark ? "#AAAAAA" : "#606060" }]}
            numberOfLines={1}
          >
            {formatViews(video.views)} views • {formatTimeAgo(video.uploadedAt)}
          </Text>
        </View>

        {/* More options button (YouTube-style three dots) */}
        <Pressable
          style={styles.moreButton}
          onPress={(e) => {
            e.stopPropagation();
            // Handle more options
          }}
          accessible
          accessibilityLabel="More options"
          accessibilityRole="button"
        >
          <Text style={[styles.moreIcon, { color: isDark ? "#FFFFFF" : "#0F0F0F" }]}>⋮</Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  gridContainer: {
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  pressed: {
    opacity: 0.9,
  },
  thumbnailContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  thumbnailHovered: {
    transform: [{ scale: 1.02 }],
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "System",
      android: "Roboto",
      default: "System",
    }),
  },
  metadata: {
    flexDirection: "row",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: "#1a1a1a",
  },
  textInfo: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 4,
  },
  channelName: {
    fontSize: 13,
    marginBottom: 2,
  },
  metadataText: {
    fontSize: 13,
  },
  moreButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  moreIcon: {
    fontSize: 20,
    fontWeight: "700",
  },
});

export default React.memo(VideoCard);

