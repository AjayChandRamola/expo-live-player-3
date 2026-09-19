/**
 * components/Shorts/ShortCard.tsx
 * 
 * Individual short video card with:
 * - Full-screen video player
 * - Tap-to-play/pause
 * - Double-tap to like
 * - Double-tap left/right to seek
 * - Progress bar
 * - Action buttons
 * - Mute toggle
 * 
 * Production-ready with gesture handling and animations
 */

import React, { memo, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import { VideoView } from "expo-video";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useShortsPlayer } from "../../hooks/useShortsPlayer";
import { ShortProgressBar } from "./ShortProgressBar";
import { ShortActions } from "./ShortActions";
import { CommentsModal } from "../Comments";
import type { VideoMetadata } from "../../types/video";
import Logger from "../../utils/Logger";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ShortCardProps {
  video: VideoMetadata;
  isActive: boolean;
  isMuted: boolean;
  onProgress: (progress: number) => void;
  onEnded: () => void;
  onToggleMute: () => void;
}

/**
 * ShortCard Component - Individual short video
 */
function ShortCardComponent({
  video,
  isActive,
  isMuted,
  onProgress,
  onEnded,
  onToggleMute,
}: ShortCardProps) {
  const [showMuteIndicator, setShowMuteIndicator] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const muteIndicatorTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for double-tap detection
  const lastTapRef = useRef<number>(0);
  const tapLocationRef = useRef<{ x: number; y: number } | null>(null);
  
  // Animation values
  const heartScale = useSharedValue(0);
  const seekIconOpacity = useSharedValue(0);
  
  // State for seek direction (can't read sharedValue during render)
  const [seekDirection, setSeekDirection] = useState<"left" | "right" | null>(null);

  // Video player hook
  const { player, isPlaying, isLoading, error, progress, play, pause, seek, retry } =
    useShortsPlayer({
      videoUrl: video.videoUrl,
      isActive,
      isMuted,
      onProgress,
      onEnded,
      videoId: video.id,
    });

  /**
   * Handle single tap - pause/play
   */
  const handleSingleTap = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  /**
   * Handle double tap - like or seek
   */
  const handleDoubleTap = useCallback((x: number, y: number) => {
    const tapX = x;
    const screenThird = SCREEN_WIDTH / 3;

    if (tapX < screenThird) {
      // Left third - seek backward
      seek(progress * video.duration / 100 - 10);
      setSeekDirection("left");
      seekIconOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 400 })
      );
      // Reset after animation
      setTimeout(() => setSeekDirection(null), 500);
      Logger.info(`[ShortCard] Seek back 10s: ${video.id}`);
    } else if (tapX > screenThird * 2) {
      // Right third - seek forward
      seek(progress * video.duration / 100 + 10);
      setSeekDirection("right");
      seekIconOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 400 })
      );
      // Reset after animation
      setTimeout(() => setSeekDirection(null), 500);
      Logger.info(`[ShortCard] Seek forward 10s: ${video.id}`);
    } else {
      // Center - like
      heartScale.value = withSequence(
        withSpring(1.5, { damping: 2 }),
        withSpring(0, { damping: 2 })
      );
      Logger.info(`[ShortCard] Double-tap like: ${video.id}`);
    }
  }, [progress, video.duration, video.id, seek, heartScale, seekIconOpacity]);

  /**
   * Handle press (native touch, won't block scroll)
   */
  const handlePress = useCallback((event: any) => {
    const now = Date.now();
    const { locationX, locationY } = event.nativeEvent;

    // Check if this is a double tap
    if (now - lastTapRef.current < 300) {
      // Double tap detected
      handleDoubleTap(locationX, locationY);
      lastTapRef.current = 0; // Reset to prevent triple tap
    } else {
      // Potential single tap - wait to see if double tap follows
      lastTapRef.current = now;
      
      setTimeout(() => {
        if (lastTapRef.current === now) {
          // No double tap followed, execute single tap
          handleSingleTap();
        }
      }, 300);
    }
  }, [handleSingleTap, handleDoubleTap]);

  /**
   * Toggle mute with indicator
   */
  const handleMuteToggle = useCallback(() => {
    onToggleMute();
    
    // Show mute indicator for 1 second
    setShowMuteIndicator(true);
    if (muteIndicatorTimer.current) {
      clearTimeout(muteIndicatorTimer.current);
    }
    muteIndicatorTimer.current = setTimeout(() => {
      setShowMuteIndicator(false);
    }, 1000);
  }, [onToggleMute]);

  /**
   * Heart animation style
   */
  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartScale.value > 0 ? 1 : 0,
  }));

  /**
   * Seek icon animation style
   */
  const seekAnimatedStyle = useAnimatedStyle(() => ({
    opacity: seekIconOpacity.value,
  }));

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#FF4444" />
          <Text style={styles.errorText}>Video unavailable</Text>
          <Pressable style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Player */}
      {player && (
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* Tap areas - positioned to not block scroll */}
      <View style={styles.tapAreas} pointerEvents="box-none">
        {/* Center tap area for play/pause */}
        <Pressable
          style={styles.centerTapArea}
          onPress={handlePress}
          delayLongPress={150}
        />
      </View>

      {/* Double Tap Heart Animation */}
      <Animated.View style={[styles.heartOverlay, heartAnimatedStyle]} pointerEvents="none">
        <MaterialCommunityIcons name="heart" size={120} color="rgba(255, 0, 0, 0.9)" />
      </Animated.View>

      {/* Seek Icons */}
      {seekDirection === "left" && (
        <Animated.View 
          style={[styles.seekIconLeft, seekAnimatedStyle]} 
          pointerEvents="none"
        >
          <MaterialCommunityIcons name="rewind-10" size={48} color="rgba(255, 255, 255, 0.9)" />
        </Animated.View>
      )}

      {seekDirection === "right" && (
        <Animated.View 
          style={[styles.seekIconRight, seekAnimatedStyle]} 
          pointerEvents="none"
        >
          <MaterialCommunityIcons name="fast-forward-10" size={48} color="rgba(255, 255, 255, 0.9)" />
        </Animated.View>
      )}

      {/* Video Info */}
      <View style={styles.infoContainer}>
        <View style={styles.channelInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{video.channelName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.channelName}>{video.channelName}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        {video.description && (
          <Text style={styles.description} numberOfLines={1}>
            {video.description}
          </Text>
        )}
      </View>

      {/* Mute Button */}
      <Pressable
        style={styles.muteButton}
        onPress={handleMuteToggle}
        accessible
        accessibilityLabel={isMuted ? "Unmute" : "Mute"}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name={isMuted ? "volume-off" : "volume-high"}
          size={28}
          color="#FFFFFF"
        />
      </Pressable>

      {/* Mute Indicator */}
      {showMuteIndicator && (
        <View style={styles.muteIndicator}>
          <MaterialCommunityIcons
            name={isMuted ? "volume-off" : "volume-high"}
            size={32}
            color="#FFFFFF"
          />
          <Text style={styles.muteIndicatorText}>
            {isMuted ? "Muted" : "Sound On"}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <ShortActions
        likes={video.likes || 0}
        videoId={video.id}
        commentCount={0}
        onComment={() => {
          setShowComments(true);
          Logger.info(`[ShortCard] Opening comments for ${video.id}`);
        }}
      />

      {/* Comments Modal */}
      <CommentsModal
        videoId={video.id}
        visible={showComments}
        onClose={() => setShowComments(false)}
      />

      {/* Progress Bar */}
      <ShortProgressBar progress={progress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  tapAreas: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  centerTapArea: {
    width: "60%",
    height: "60%",
    backgroundColor: "transparent",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#FF0000",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  heartOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -60,
    marginTop: -60,
  },
  seekIconLeft: {
    position: "absolute",
    left: 32,
    top: "50%",
    marginTop: -24,
  },
  seekIconRight: {
    position: "absolute",
    right: 32,
    top: "50%",
    marginTop: -24,
  },
  infoContainer: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 80,
  },
  channelInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  channelName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "400",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  muteButton: {
    position: "absolute",
    top: 56,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  muteIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -80,
    marginTop: -40,
    width: 160,
    height: 80,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  muteIndicatorText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
});

export const ShortCard = memo(ShortCardComponent);

export default ShortCard;

