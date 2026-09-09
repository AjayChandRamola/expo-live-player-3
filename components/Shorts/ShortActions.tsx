/**
 * components/Shorts/ShortActions.tsx
 * 
 * Action buttons for short videos
 * - Like button with count
 * - Dislike button
 * - Comment button
 * - Share button
 * - YouTube Shorts style vertical layout
 * 
 * Production-ready with animations and accessibility
 */

import React, { memo, useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import Logger from "../../utils/Logger";

interface ShortActionsProps {
  likes: number;
  videoId: string;
  commentCount?: number;
  onLike?: () => void;
  onDislike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}

/**
 * Format number for display (e.g., 1.2K, 3.4M)
 */
function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * ShortActions Component
 */
function ShortActionsComponent({
  likes: initialLikes,
  videoId,
  commentCount = 0,
  onLike,
  onDislike,
  onComment,
  onShare,
}: ShortActionsProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  
  const likeScale = useSharedValue(1);

  /**
   * Handle like button press with animation
   */
  const handleLike = useCallback(() => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikes((prev) => (newLiked ? prev + 1 : prev - 1));

    // Heart animation
    likeScale.value = withSequence(
      withSpring(1.3, { damping: 2 }),
      withSpring(1, { damping: 2 })
    );

    Logger.info(`[ShortActions] ${newLiked ? "Liked" : "Unliked"} video ${videoId}`);
    onLike?.();
  }, [isLiked, videoId, onLike, likeScale]);

  /**
   * Handle dislike
   */
  const handleDislike = useCallback(() => {
    Logger.info(`[ShortActions] Disliked video ${videoId}`);
    onDislike?.();
  }, [videoId, onDislike]);

  /**
   * Handle comment
   */
  const handleComment = useCallback(() => {
    Logger.info(`[ShortActions] Comment on video ${videoId}`);
    onComment?.();
  }, [videoId, onComment]);

  /**
   * Handle share
   */
  const handleShare = useCallback(() => {
    Logger.info(`[ShortActions] Share video ${videoId}`);
    onShare?.();
  }, [videoId, onShare]);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Like Button */}
      <Pressable
        onPress={handleLike}
        style={styles.actionButton}
        accessible
        accessibilityLabel="Like video"
        accessibilityRole="button"
        accessibilityState={{ checked: isLiked }}
      >
        <Animated.View style={likeAnimatedStyle}>
          <MaterialCommunityIcons
            name={isLiked ? "heart" : "heart-outline"}
            size={32}
            color={isLiked ? "#FF0000" : "#FFFFFF"}
          />
        </Animated.View>
        <Text style={styles.actionText}>{formatCount(likes)}</Text>
      </Pressable>

      {/* Dislike Button */}
      <Pressable
        onPress={handleDislike}
        style={styles.actionButton}
        accessible
        accessibilityLabel="Dislike video"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="thumb-down-outline"
          size={32}
          color="#FFFFFF"
        />
        <Text style={styles.actionText}>Dislike</Text>
      </Pressable>

      {/* Comment Button */}
      <Pressable
        onPress={handleComment}
        style={styles.actionButton}
        accessible
        accessibilityLabel="Comment on video"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="comment-outline"
          size={32}
          color="#FFFFFF"
        />
        {commentCount > 0 && (
          <Text style={styles.actionText}>{formatCount(commentCount)}</Text>
        )}
      </Pressable>

      {/* Share Button */}
      <Pressable
        onPress={handleShare}
        style={styles.actionButton}
        accessible
        accessibilityLabel="Share video"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="share-outline"
          size={32}
          color="#FFFFFF"
        />
        <Text style={styles.actionText}>Share</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 12,
    bottom: 80,
    alignItems: "center",
    gap: 24,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export const ShortActions = memo(ShortActionsComponent);

export default ShortActions;

