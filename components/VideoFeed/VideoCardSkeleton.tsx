/**
 * components/VideoFeed/VideoCardSkeleton.tsx
 * 
 * Skeleton loader for video cards while content is loading
 * Provides visual feedback during data fetch
 * Matches YouTube 2025 loading aesthetic
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, useColorScheme } from "react-native";

interface VideoCardSkeletonProps {
  variant?: "list" | "grid";
}

const VideoCardSkeleton: React.FC<VideoCardSkeletonProps> = ({ variant = "list" }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  
  // Shimmer animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const baseColor = isDark ? "#1a1a1a" : "#e0e0e0";
  const shimmerColor = isDark ? "#2a2a2a" : "#f0f0f0";

  return (
    <View style={[styles.container, variant === "grid" && styles.gridContainer]}>
      {/* Thumbnail skeleton */}
      <View style={[styles.thumbnail, { backgroundColor: baseColor }]}>
        <Animated.View
          style={[
            styles.shimmer,
            {
              backgroundColor: shimmerColor,
              opacity: shimmerOpacity,
            },
          ]}
        />
      </View>

      {/* Metadata skeleton */}
      <View style={styles.metadata}>
        {/* Avatar skeleton */}
        <View style={[styles.avatar, { backgroundColor: baseColor }]}>
          <Animated.View
            style={[
              styles.shimmerCircle,
              {
                backgroundColor: shimmerColor,
                opacity: shimmerOpacity,
              },
            ]}
          />
        </View>

        {/* Text info skeleton */}
        <View style={styles.textInfo}>
          {/* Title lines */}
          <View style={[styles.titleLine, { backgroundColor: baseColor, width: "90%" }]}>
            <Animated.View
              style={[
                styles.shimmerLine,
                {
                  backgroundColor: shimmerColor,
                  opacity: shimmerOpacity,
                },
              ]}
            />
          </View>
          <View style={[styles.titleLine, { backgroundColor: baseColor, width: "70%", marginTop: 6 }]}>
            <Animated.View
              style={[
                styles.shimmerLine,
                {
                  backgroundColor: shimmerColor,
                  opacity: shimmerOpacity,
                },
              ]}
            />
          </View>

          {/* Metadata line */}
          <View style={[styles.metaLine, { backgroundColor: baseColor, width: "60%", marginTop: 8 }]}>
            <Animated.View
              style={[
                styles.shimmerLine,
                {
                  backgroundColor: shimmerColor,
                  opacity: shimmerOpacity,
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
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
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    overflow: "hidden",
    position: "relative",
  },
  shimmerCircle: {
    width: "100%",
    height: "100%",
  },
  textInfo: {
    flex: 1,
  },
  titleLine: {
    height: 14,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  metaLine: {
    height: 12,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  shimmerLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default React.memo(VideoCardSkeleton);

