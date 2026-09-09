/**
 * Home Screen — Clean & Safe Version
 */

import { useRouter } from "expo-router";
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { VideoFeed } from "../../components/VideoFeed";
import { Colors } from "../../constants/theme";
import { useVideoPlayerContext } from "../../contexts/VideoPlayerContext";
import type { VideoMetadata } from "../../types/video";
import Logger from "../../utils/Logger";

// Sanitize input
const sanitizeText = (text: unknown, max = 200): string =>
  typeof text === "string"
    ? text.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max)
    : "";

function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

  const { setVideoList, playVideoById } = useVideoPlayerContext();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [allVideos, setAllVideos] = useState<VideoMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(false);

  // Log initial mount
  useEffect(() => {
    if (!mountedRef.current) {
      Logger.info("[HomeScreen] Mounted with theme:", colorScheme);
      mountedRef.current = true;
    }
  }, [colorScheme]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();

    if (trimmed.length === 0) {
      setDebouncedQuery("");
      setIsSearchMode(false);
      setIsSearching(false);
      return;
    }

    setIsSearchMode(true);
    setIsSearching(true);

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(trimmed);
      setIsSearching(false);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [query]);

  const setVideoListRef = useRef(setVideoList);
  const lastVideoListRef = useRef("");

  useEffect(() => {
    setVideoListRef.current = setVideoList;
  }, [setVideoList]);

  const handleVideosLoaded = useCallback(
    (videos: VideoMetadata[]) => {
      const ids = videos.map((v) => v.id).join(",");

      if (lastVideoListRef.current === ids && videos.length === allVideos.length) {
        return;
      }

      lastVideoListRef.current = ids;

      requestAnimationFrame(() => {
        setAllVideos(videos);
        setVideoListRef.current(videos);
      });
    },
    [allVideos.length]
  );

  const handleVideoPress = useCallback(
    (video: VideoMetadata) => {
      const safeId = sanitizeText(video.id, 64);
      if (!safeId) return;

      playVideoById(safeId);
      router.push(`/video/${encodeURIComponent(safeId)}`);
    },
    [router, playVideoById]
  );

  const handleSearchChange = useCallback((text: string) => {
    const sanitized = sanitizeText(text, 100);
    setQuery(sanitized);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setDebouncedQuery("");
      setIsSearchMode(false);
      setIsSearching(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setDebouncedQuery(trimmed);
    setIsSearching(false);
    setIsSearchMode(true);
  }, [query]);

  const handleClearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setQuery("");
    setDebouncedQuery("");
    setIsSearchMode(false);
    setIsSearching(false);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Yagna Vishnu Bhagwan
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.subtle }]}>
          Divya Darshan
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Search videos..."
            placeholderTextColor={theme.placeholder}
            style={[
              styles.searchInput,
              {
                color: theme.text,
                backgroundColor: theme.inputBackground,
                borderColor: isSearchMode ? theme.tint : theme.border,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {isSearching && (
            <View style={styles.searchIndicator}>
              <ActivityIndicator size="small" color={theme.tint} />
            </View>
          )}

          {query.length > 0 && (
            <Pressable onPress={handleClearSearch} style={styles.clearBtn}>
              <Text style={[styles.clearText, { color: theme.tint }]}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      <VideoFeed
        key="video-feed"
        pageSize={10}
        variant="auto"
        onVideoPress={handleVideoPress}
        onVideosLoaded={handleVideosLoaded}
        searchQuery={debouncedQuery}
        isSearchMode={isSearchMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 8 : 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  searchIndicator: {
    position: "absolute",
    right: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingRight: 50,
    borderWidth: 1,
    fontSize: 15,
  },
  clearBtn: {
    position: "absolute",
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  clearText: {
    fontSize: 18,
    fontWeight: "600",
  },
});

export default memo(HomeScreen);
