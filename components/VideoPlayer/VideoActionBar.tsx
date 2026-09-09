/**
 * components/VideoPlayer/VideoActionBar.tsx
 * 
 * YouTube-style action bar with 7 buttons:
 * - Like, Dislike, Share, Download, Clip, Save, More
 * - Horizontal scrollable row
 * - Pilled buttons with icons and labels
 * 
 * Production-ready, accessible, performant
 */

import React, { memo, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { VideoActionButton } from "./VideoActionButton";
import Logger from "../../utils/Logger";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface VideoActionBarProps {
  /**
   * Video ID
   */
  videoId: string;

  /**
   * Video title (for sharing)
   */
  videoTitle?: string;

  /**
   * Video URL (for sharing)
   */
  videoUrl?: string;

  /**
   * Channel ID (for don't recommend)
   */
  channelId?: string;

  /**
   * Current like state
   */
  isLiked: boolean;

  /**
   * Current dislike state
   */
  isDisliked: boolean;

  /**
   * Like count
   */
  likeCount: number;

  /**
   * Dislike count
   */
  dislikeCount: number;

  /**
   * Whether video is saved
   */
  isSaved: boolean;

  /**
   * Callbacks
   */
  onLike: () => void;
  onDislike: () => void;
  onShare: () => void;
  onDownload: () => void;
  onClip: () => void;
  onSave: () => void;
  onMore: () => void;
}

/**
 * VideoActionBar Component
 */
export const VideoActionBar = memo(function VideoActionBar({
  videoId,
  videoTitle,
  videoUrl,
  channelId,
  isLiked,
  isDisliked,
  likeCount,
  dislikeCount,
  isSaved,
  onLike,
  onDislike,
  onShare,
  onDownload,
  onClip,
  onSave,
  onMore,
}: VideoActionBarProps) {
  // Safe area insets for preventing overlap with system navigation
  const insets = useSafeAreaInsets();
  /**
   * Handle like press
   */
  const handleLike = useCallback(() => {
    Logger.info("[VideoActionBar] Like pressed", { videoId, currentlyLiked: isLiked });
    onLike();
  }, [videoId, isLiked, onLike]);

  /**
   * Handle dislike press
   */
  const handleDislike = useCallback(() => {
    Logger.info("[VideoActionBar] Dislike pressed", { videoId, currentlyDisliked: isDisliked });
    onDislike();
  }, [videoId, isDisliked, onDislike]);

  /**
   * Handle share press
   */
  const handleShare = useCallback(() => {
    Logger.info("[VideoActionBar] Share pressed", { videoId });
    onShare();
  }, [videoId, onShare]);

  /**
   * Handle download press
   */
  const handleDownload = useCallback(() => {
    Logger.info("[VideoActionBar] Download pressed", { videoId });
    onDownload();
  }, [videoId, onDownload]);

  /**
   * Handle clip press
   */
  const handleClip = useCallback(() => {
    Logger.info("[VideoActionBar] Clip pressed", { videoId });
    onClip();
  }, [videoId, onClip]);

  /**
   * Handle save press
   */
  const handleSave = useCallback(() => {
    Logger.info("[VideoActionBar] Save pressed", { videoId, currentlySaved: isSaved });
    onSave();
  }, [videoId, isSaved, onSave]);

  /**
   * Handle more press
   */
  const handleMore = useCallback(() => {
    Logger.info("[VideoActionBar] More pressed", { videoId });
    onMore();
  }, [videoId, onMore]);

  // Log applied bottom padding
  useEffect(() => {
    Logger.info("[UI] applied_bottom_padding", {
      component: "VideoActionBar",
      bottomInset: insets.bottom,
      basePadding: 0, // No base padding - only safe area when needed
      finalPadding: Math.max(insets.bottom > 0 ? insets.bottom : 0, 0),
      platform: Platform.OS,
      videoId,
      whiteSpaceReduction: "eliminated unnecessary white space below action buttons",
    });
  }, [insets.bottom, videoId]);

  return (
    <View 
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom > 0 ? insets.bottom : 0, 0) } // Only safe area bottom padding, no extra white space
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* Like Button */}
        <VideoActionButton
          icon={isLiked ? "thumb-up" : "thumb-up-outline"}
          label={likeCount > 0 ? formatCount(likeCount) : "Like"}
          active={isLiked}
          onPress={handleLike}
          accessibilityLabel={`Like button. ${isLiked ? "Currently liked" : "Press to like this video"}. ${likeCount > 0 ? `${likeCount} likes` : ""}`}
        />

        {/* Dislike Button */}
        <VideoActionButton
          icon={isDisliked ? "thumb-down" : "thumb-down-outline"}
          label="Dislike"
          active={isDisliked}
          onPress={handleDislike}
          accessibilityLabel={`Dislike button. ${isDisliked ? "Currently disliked" : "Press to dislike this video"}`}
        />

        {/* Share Button */}
        <VideoActionButton
          icon="share-variant"
          label="Share"
          active={false}
          onPress={handleShare}
          accessibilityLabel="Share button. Press to share this video"
        />

        {/* Download Button */}
        <VideoActionButton
          icon="download"
          label="Download"
          active={false}
          onPress={handleDownload}
          accessibilityLabel="Download button. Press to download this video"
        />

        {/* Clip Button */}
        <VideoActionButton
          icon="scissors-cutting"
          label="Clip"
          active={false}
          onPress={handleClip}
          accessibilityLabel="Clip button. Press to create a clip from this video"
        />

        {/* Save Button */}
        <VideoActionButton
          icon={isSaved ? "playlist-check" : "playlist-plus"}
          label={isSaved ? "Saved" : "Save"}
          active={isSaved}
          onPress={handleSave}
          accessibilityLabel={`Save button. ${isSaved ? "Currently saved" : "Press to save this video to a playlist"}`}
        />

        {/* More Button */}
        <VideoActionButton
          icon="dots-vertical"
          label="More"
          active={false}
          onPress={handleMore}
          accessibilityLabel="More options button. Press to see more options"
        />
      </ScrollView>
    </View>
  );
});

/**
 * Format count for display (e.g., 1.2K, 5.6M)
 */
function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0, // Removed top padding to eliminate gap between progress bar and action buttons
    paddingBottom: 0, // Removed bottom padding to eliminate white space below buttons (safe area will be added separately)
    paddingHorizontal: 4,
    borderTopWidth: 0, // Removed border to reduce visual gap
    borderTopColor: "transparent",
    backgroundColor: "#FFFFFF", // YouTube-style white background (matches progress bar container)
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
});

