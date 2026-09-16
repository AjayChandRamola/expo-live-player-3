/**
 * components/VideoFeed/VideoFeed.tsx
 * 
 * YouTube 2025-style scrollable video feed
 * - Infinite scroll with pagination
 * - Lazy loading and performance optimization
 * - Responsive grid/list layout
 * - Pull-to-refresh support
 * - Error handling and retry logic
 * 
 * Dependencies: react, react-native, expo-router
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  useColorScheme,
  useWindowDimensions,
  Platform,
} from "react-native";
import VideoCard from "./VideoCard";
import VideoCardSkeleton from "./VideoCardSkeleton";
import type { VideoMetadata } from "../../types/video";
import { fetchVideoFeed, searchVideos } from "../../services/videoService";
import Logger from "../../utils/Logger";

interface VideoFeedProps {
  initialVideos?: VideoMetadata[];
  pageSize?: number;
  variant?: "list" | "grid" | "auto";
  onVideoPress?: (video: VideoMetadata) => void;
  onVideosLoaded?: (videos: VideoMetadata[]) => void;
  searchQuery?: string; // Optional search query
  isSearchMode?: boolean; // Whether in search mode
  testID?: string;
  /** Externally controlled refresh state, e.g. from a screen's own data hook. */
  refreshing?: boolean;
  /** Called in addition to the feed's own refresh when the list is pulled. */
  onRefresh?: () => void;
}

const VideoFeed: React.FC<VideoFeedProps> = ({
  initialVideos = [],
  pageSize = 10,
  variant = "auto",
  onVideoPress,
  onVideosLoaded,
  searchQuery = "",
  isSearchMode = false,
  testID,
  refreshing: externalRefreshing,
  onRefresh: externalOnRefresh,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width } = useWindowDimensions();

  // Determine layout variant based on screen width
  const layoutVariant = useMemo(() => {
    if (variant === "auto") {
      // Responsive breakpoints (YouTube-style)
      if (width >= 1024) return "grid"; // Desktop: grid
      if (width >= 768) return "grid";  // Tablet: grid
      return "list";                     // Mobile: list
    }
    return variant;
  }, [variant, width]);

  // Number of columns for grid layout
  const numColumns = useMemo(() => {
    if (layoutVariant === "list") return 1;
    if (width >= 1024) return 3; // Desktop: 3 columns
    if (width >= 768) return 2;  // Tablet: 2 columns
    return 1;
  }, [layoutVariant, width]);

  // State management
  const [videos, setVideos] = useState<VideoMetadata[]>(initialVideos);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [initialLoad, setInitialLoad] = useState<boolean>(true);

  /**
   * Load initial videos (regular feed or search)
   * Uses refs to avoid dependency issues and prevent infinite loops
   */
  const isSearchModeRef = useRef<boolean>(isSearchMode || false);
  const searchQueryRef = useRef<string>(searchQuery || "");
  const onVideosLoadedRef = useRef(onVideosLoaded);
  
  // Update refs without causing re-renders
  useEffect(() => {
    isSearchModeRef.current = isSearchMode || false;
    searchQueryRef.current = searchQuery || "";
  }, [isSearchMode, searchQuery]);
  
  useEffect(() => {
    onVideosLoadedRef.current = onVideosLoaded;
  }, [onVideosLoaded]);

  const loadInitialVideos = useCallback(async (query: string = "", forceSearchMode?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use passed search mode if provided, otherwise check ref
      const inSearchMode = forceSearchMode !== undefined ? forceSearchMode : isSearchModeRef.current;
      
      // Determine if we should search: query exists AND in search mode
      const shouldSearch = query.trim().length > 0 && inSearchMode;
      
      if (shouldSearch) {
        Logger.info(`[VideoFeed] Loading search results for: "${query}"`);
      } else {
        Logger.info("[VideoFeed] Loading initial videos");
      }

      // Use search service if we should search, otherwise use regular feed
      const response = shouldSearch
        ? await searchVideos(query.trim(), 0, pageSize)
        : await fetchVideoFeed(0, pageSize);
      
      setVideos(response.videos);
      setHasMore(response.hasMore);
      setPage(1);
      setInitialLoad(false);
      isLoadingRef.current = false; // Mark as done loading

      // Notify parent of loaded videos (defer to next tick to avoid render loops)
      const callback = onVideosLoadedRef.current;
      if (callback) {
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(() => {
          callback(response.videos);
        });
      }

      Logger.info(`[VideoFeed] Loaded ${response.videos.length} videos`);
    } catch (err: any) {
      isLoadingRef.current = false; // Mark as done even on error
      const inSearchMode = forceSearchMode !== undefined ? forceSearchMode : isSearchModeRef.current;
      const errorMsg = err?.message || (inSearchMode ? "Search failed" : "Failed to load videos");
      setError(errorMsg);
      Logger.error("[VideoFeed] Initial load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [pageSize]); // Only depend on pageSize, use refs for everything else

  /**
   * Load more videos (pagination) - supports both regular feed and search
   */
  const loadMoreVideos = useCallback(async () => {
    if (loadingMore || !hasMore || loading) {
      return;
    }

    try {
      setLoadingMore(true);
      const query = searchQueryRef.current || "";
      const currentSearchMode = isSearchModeRef.current;
      
      // Determine if we should search: query exists AND in search mode
      const shouldSearch = query.trim().length > 0 && currentSearchMode;
      
      if (shouldSearch) {
        Logger.info(`[VideoFeed] Loading search page ${page} for: "${query}"`);
      } else {
        Logger.info(`[VideoFeed] Loading page ${page}`);
      }

      // Use search service if we should search, otherwise use regular feed
      const response = shouldSearch
        ? await searchVideos(query.trim(), page, pageSize)
        : await fetchVideoFeed(page, pageSize);

      const updatedVideos = [...videos, ...response.videos];
      setVideos(updatedVideos);
      setHasMore(response.hasMore);
      setPage((p) => p + 1);

      // Update global list (defer to next tick to avoid render loops)
      const callback = onVideosLoadedRef.current;
      if (callback) {
        requestAnimationFrame(() => {
          callback(updatedVideos);
        });
      }

      Logger.info(`[VideoFeed] Loaded ${response.videos.length} more videos`);
    } catch (err: any) {
      Logger.error("[VideoFeed] Load more failed:", err);
      // Don't show error for pagination failures, just stop loading
    } finally {
      setLoadingMore(false);
    }
  }, [page, pageSize, loadingMore, hasMore, loading, videos]);

  /**
   * Pull to refresh - supports both regular feed and search
   */
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const query = searchQueryRef.current || "";
      const currentSearchMode = isSearchModeRef.current;
      
      // Determine if we should search: query exists AND in search mode
      const shouldSearch = query.trim().length > 0 && currentSearchMode;
      
      if (shouldSearch) {
        Logger.info(`[VideoFeed] Refreshing search: "${query}"`);
      } else {
        Logger.info("[VideoFeed] Refreshing feed");
      }

      // Use search service if we should search, otherwise use regular feed
      const response = shouldSearch
        ? await searchVideos(query.trim(), 0, pageSize)
        : await fetchVideoFeed(0, pageSize);

      setVideos(response.videos);
      setHasMore(response.hasMore);
      setPage(1);

      // Notify parent of refreshed videos (defer to next tick to avoid render loops)
      const callback = onVideosLoadedRef.current;
      if (callback) {
        requestAnimationFrame(() => {
          callback(response.videos);
        });
      }

      Logger.info("[VideoFeed] Refresh complete");
    } catch (err: any) {
      const currentSearchMode = isSearchModeRef.current;
      const errorMsg = err?.message || (currentSearchMode ? "Search refresh failed" : "Failed to refresh");
      setError(errorMsg);
      Logger.error("[VideoFeed] Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [pageSize]);

  const handlePullToRefresh = useCallback(() => {
    externalOnRefresh?.();
    void handleRefresh();
  }, [externalOnRefresh, handleRefresh]);

  /**
   * Retry after error
   */
  const handleRetry = useCallback(() => {
    const query = searchQueryRef.current || "";
    const currentSearchMode = isSearchModeRef.current;
    loadInitialVideos(query, currentSearchMode);
  }, [loadInitialVideos]);

  // Track previous search query to detect changes
  const prevSearchQueryRef = useRef<string>("");
  const prevSearchModeRef = useRef<boolean>(false);

  // Track if component has mounted to prevent double-loading
  const hasMountedRef = useRef<boolean>(false);
  const isLoadingRef = useRef<boolean>(false);
  
  // Use ref for loadInitialVideos to avoid dependency issues
  const loadInitialVideosRef = useRef(loadInitialVideos);
  useEffect(() => {
    loadInitialVideosRef.current = loadInitialVideos;
  }, [loadInitialVideos]);

  // Load initial videos on mount only - ensure it only runs once
  useEffect(() => {
    if (hasMountedRef.current) {
      return; // Already mounted, skip
    }
    hasMountedRef.current = true;
    isLoadingRef.current = true;
    
    Logger.info("[VideoFeed] Component mounting, loading initial videos");
    
    if (initialVideos.length === 0) {
      loadInitialVideosRef.current("");
    } else {
      setInitialLoad(false);
      setVideos(initialVideos);
      isLoadingRef.current = false;
      // Notify parent if initial videos provided
      if (onVideosLoadedRef.current) {
        requestAnimationFrame(() => {
          onVideosLoadedRef.current?.(initialVideos);
        });
      }
    }
    // Initialize refs
    prevSearchQueryRef.current = searchQuery || "";
    prevSearchModeRef.current = isSearchMode || false;
  }, []); // Only run on mount - empty deps

  // Reset and reload when search query/mode changes (after initial load completes)
  useEffect(() => {
    // Skip if not mounted yet, still on initial load, or already loading
    if (!hasMountedRef.current || initialLoad || isLoadingRef.current) {
      return;
    }

    // Only reload if search query or mode actually changed
    const currentQuery = searchQuery || "";
    const currentMode = isSearchMode || false;
    const queryChanged = prevSearchQueryRef.current !== currentQuery;
    const modeChanged = prevSearchModeRef.current !== currentMode;

    if (queryChanged || modeChanged) {
      prevSearchQueryRef.current = currentQuery;
      prevSearchModeRef.current = currentMode;
      isLoadingRef.current = true;

      if (currentMode && currentQuery.trim()) {
        // Entering search mode with query
        Logger.info(`[VideoFeed] Search query changed: "${currentQuery}", mode: ${currentMode}`);
        setPage(0);
        setHasMore(true);
        setVideos([]);
        setError(null);
        // Pass search mode explicitly to avoid race conditions with ref
        loadInitialVideosRef.current(currentQuery, true);
      } else if (!currentMode && currentQuery.trim().length === 0) {
        // Exiting search mode - reset to regular feed
        Logger.info("[VideoFeed] Exiting search mode, loading regular feed");
        setPage(0);
        setHasMore(true);
        setVideos([]);
        setError(null);
        // Pass search mode explicitly
        loadInitialVideosRef.current("", false);
      }
    }
  }, [searchQuery, isSearchMode, initialLoad]); // Only react to search query/mode changes

  /**
   * Render video card item
   */
  const renderItem = useCallback(
    ({ item }: { item: VideoMetadata }) => (
      <VideoCard
        video={item}
        variant={layoutVariant}
        onPress={onVideoPress}
      />
    ),
    [layoutVariant, onVideoPress]
  );

  /**
   * Key extractor for FlatList optimization
   */
  const keyExtractor = useCallback((item: VideoMetadata) => item.id, []);

  /**
   * Render footer (loading more indicator)
   */
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0ea5ff" />
        <Text style={[styles.footerText, { color: isDark ? "#AAAAAA" : "#606060" }]}>
          Loading more videos...
        </Text>
      </View>
    );
  }, [loadingMore, isDark]);

  /**
   * Render empty state
   */
  const renderEmpty = useCallback(() => {
    if (loading || initialLoad) {
      // Show skeletons during initial load
      return (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 5 }).map((_, i) => (
            <VideoCardSkeleton key={`skeleton-${i}`} variant={layoutVariant} />
          ))}
        </View>
      );
    }

    if (error) {
      // Show error state
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={[styles.emptyTitle, { color: isDark ? "#FFFFFF" : "#0F0F0F" }]}>
            Unable to load videos
          </Text>
          <Text style={[styles.emptyText, { color: isDark ? "#AAAAAA" : "#606060" }]}>
            {error}
          </Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    // No videos - show different message for search vs regular feed
    const emptyTitle = isSearchMode ? "No results found" : "No videos yet";
    const emptyText = isSearchMode
      ? searchQuery.trim()
        ? `Try a different search term or check your spelling`
        : "Start typing to search for videos"
      : "Check back later for new content";
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{isSearchMode ? "🔍" : "📹"}</Text>
        <Text style={[styles.emptyTitle, { color: isDark ? "#FFFFFF" : "#0F0F0F" }]}>
          {emptyTitle}
        </Text>
        <Text style={[styles.emptyText, { color: isDark ? "#AAAAAA" : "#606060" }]}>
          {emptyText}
        </Text>
      </View>
    );
  }, [loading, initialLoad, error, isDark, layoutVariant, handleRetry, isSearchMode, searchQuery]);

  /**
   * Handle end reached (infinite scroll)
   */
  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      loadMoreVideos();
    }
  }, [hasMore, loadingMore, loading, loadMoreVideos]);

  /**
   * Get item layout for optimization (reduce layout calculations)
   */
  const getItemLayout = useCallback(
    (_: any, index: number) => {
      const ITEM_HEIGHT = layoutVariant === "grid" ? 220 : 240;
      return {
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      };
    },
    [layoutVariant]
  );

  return (
    <View style={styles.container}>
      <FlatList
        testID={testID}
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        key={`${layoutVariant}-${numColumns}`} // Force re-render on layout change
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        getItemLayout={getItemLayout}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        removeClippedSubviews={Platform.OS === "android"}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={externalRefreshing ?? refreshing}
            onRefresh={handlePullToRefresh}
            tintColor="#0ea5ff"
            colors={["#0ea5ff"]}
            title="Pull to refresh"
            titleColor={isDark ? "#AAAAAA" : "#606060"}
          />
        }
        initialNumToRender={5}
        accessible
        accessibilityLabel="Video feed"
        accessibilityHint="Scroll to see more videos"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  skeletonContainer: {
    paddingTop: 8,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    marginTop: 8,
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
    minHeight: 400,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#0ea5ff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
      },
    }),
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default React.memo(VideoFeed);

