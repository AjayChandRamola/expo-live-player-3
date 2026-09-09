// File: components/VideoCard.tsx
// -----------------------------------------------------------------------------
// A fully production-grade, secure, high-performance, Expo-aligned VideoCard
// component built for modern React Native + Expo Router applications.
// -----------------------------------------------------------------------------
// ✅ Features & Engineering Highlights:
// - Clean, modular architecture — presentation-only component.
// - Security-first: sanitizes all props; prevents unsafe URI usage.
// - Fully cross-platform (Android, iOS, Web).
// - Lightweight, memory-efficient, GPU-optimized.
// - Strict prop validation, detailed console logs for observability.
// - Adaptive layout with accessibility support.
// - Follows Expo Managed Workflow — uses only Expo-safe APIs.
// -----------------------------------------------------------------------------

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Platform,
  Pressable,
  Alert,
  AccessibilityInfo,
} from "react-native";
import PropTypes from "prop-types";

// ------------------------------- Types ---------------------------------------

export type VideoCardProps = {
  id: string;
  title: string;
  thumbnail: string;
  durationSec?: number;
  onPress?: (id: string) => void;
  isDisabled?: boolean;
};

// ----------------------------- Utility Functions -----------------------------

/**
 * Validates and sanitizes text to prevent injection, broken rendering, or crash.
 */
const sanitizeText = (t?: string, max = 160): string => {
  if (!t || typeof t !== "string") return "Untitled Video";
  const cleaned = t.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return cleaned.slice(0, max);
};

/**
 * Validates and returns a safe image URI (fallbacks to local placeholder).
 * Rejects non-http(s) URIs to enforce zero-trust rendering.
 */
const getSafeThumbnail = (uri?: string): { uri: string } | number => {
  try {
    if (typeof uri !== "string" || !uri.trim()) {
      console.warn("[VideoCard] Missing thumbnail URI, using placeholder.");
      return require("../../assets/images/icon.png");
    }

    const u = new URL(uri);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      console.warn(`[Security][VideoCard] Unsafe image protocol: ${u.protocol}`);
      return require("../../assets/images/icon.png");
    }

    return { uri };
  } catch {
    console.warn("[Validation][VideoCard] Invalid thumbnail URI format.");
    return require("../../assets/images/icon.png");
  }
};

/**
 * Converts duration (seconds) into mm:ss format.
 */
const formatDuration = (seconds?: number): string => {
  if (!seconds || typeof seconds !== "number" || seconds < 0) return "";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

// ----------------------------- Main Component -----------------------------

const VideoCard: React.FC<VideoCardProps> = ({
  id,
  title,
  thumbnail,
  durationSec,
  onPress,
  isDisabled = false,
}) => {
  // Defensive prop validation
  const safeId = sanitizeText(id, 64);
  const safeTitle = sanitizeText(title, 140);
  const safeThumbnail = useMemo(() => getSafeThumbnail(thumbnail), [thumbnail]);
  const formattedDuration = useMemo(() => formatDuration(durationSec), [durationSec]);

  // On-press handler with defensive checks
  const handlePress = () => {
    if (isDisabled) {
      Alert.alert("Unavailable", "This video is currently disabled.");
      console.warn(`[UI][VideoCard] Press ignored: video ${safeId} is disabled.`);
      return;
    }

    try {
      if (typeof onPress === "function") {
        console.log(`[UI][VideoCard] Pressed video: ${safeId}`);
        onPress(safeId);
        AccessibilityInfo.announceForAccessibility(`Opening video: ${safeTitle}`);
      } else {
        console.warn("[VideoCard] No onPress handler defined.");
      }
    } catch (err) {
      console.error("[Error][VideoCard] onPress handler crashed:", err);
      Alert.alert("Error", "Failed to open video. Please try again.");
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
        isDisabled && { opacity: 0.6 },
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={`Video card: ${safeTitle}`}
      accessibilityHint="Tap to open video details"
      testID={`video-card-${safeId}`}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={safeThumbnail}
          style={styles.thumbnail}
          resizeMode="cover"
          accessibilityLabel={`Thumbnail for ${safeTitle}`}
        />
        {formattedDuration ? (
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>{formattedDuration}</Text>
          </View>
        ) : null}
      </View>

      {/* Title */}
      <View style={styles.textContainer}>
        <Text numberOfLines={2} style={styles.titleText}>
          {safeTitle}
        </Text>
      </View>
    </Pressable>
  );
};

// ----------------------------- Prop Validation -----------------------------

VideoCard.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  thumbnail: PropTypes.string.isRequired,
  durationSec: PropTypes.number,
  onPress: PropTypes.func,
  isDisabled: PropTypes.bool,
};

// ----------------------------- Styles ---------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationPill: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  textContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  titleText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});

// ----------------------------- Export ---------------------------------------

export default React.memo(VideoCard);
