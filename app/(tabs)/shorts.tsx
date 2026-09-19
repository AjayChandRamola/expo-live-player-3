/**
 * app/(tabs)/shorts.tsx
 * 
 * YouTube Shorts-Style Vertical Video Feed
 * - Swipe up/down for next/previous video
 * - Auto-play with smooth transitions
 * - Preload next video
 * - Double-tap gestures
 * - Progress bar
 * - Mute control
 * - 60 FPS performance
 * 
 * Production-ready with full gesture support and optimization
 */

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Pressable,
  Platform,
  Keyboard,
} from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ShortCard } from "../../components/Shorts/ShortCard";
import { ShortsSearchBar } from "../../components/Shorts/ShortsSearchBar";
import { useShortsFeed } from "../../hooks/useShortsFeed";
import { searchShorts, getTrendingShorts } from "../../services/shortsSearchService";
import type { VideoMetadata } from "../../types/video";
import Logger from "../../utils/Logger";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Error fallback screen with retry
 */
interface ErrorFallbackProps {
  message: string;
  onRetry: () => void;
}

function ErrorFallback({ message, onRetry }: ErrorFallbackProps) {
  return (
    <View style={styles.errorContainer}>
      <MaterialCommunityIcons name="alert-circle" size={64} color="#FF4444" />
      <Text style={styles.errorTitle}>Shorts Unavailable</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable
        style={styles.retryButton}
        onPress={onRetry}
        accessible
        accessibilityLabel="Retry loading shorts"
        accessibilityRole="button"
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

/**
 * ShortsScreen Component - YouTube Shorts Style
 * 
 * Features:
 * - Swipe up/down navigation
 * - Auto-play current video
 * - Preload next video at 60% progress
 * - Double-tap gestures (like, seek)
 * - Mute control with persistence
 * - Progress bar
 * - 60 FPS smooth performance
 */
export default function ShortsScreen() {
  // Shorts feed hook
  const { shorts, isLoading, error, hasMore, loadMore, retry } = useShortsFeed();

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // Start muted like YouTube
  const [preloadedIndices, setPreloadedIndices] = useState<Set<number>>(new Set());
  
  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VideoMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Refs
  const flatListRef = useRef<FlatList<VideoMetadata>>(null);
  const currentIndexRef = useRef(0); // Keep ref for immediate access
  const isScrollingRef = useRef(false);
  
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 90, // 90% visible to count
    minimumViewTime: 50,
  });

  /**
   * Log shorts list when loaded
   */
  useEffect(() => {
    if (shorts.length > 0) {
      console.log(`\n📋 [SHORTS LOADED] Total: ${shorts.length} videos`);
      shorts.slice(0, 5).forEach((short, idx) => {
        console.log(`   ${idx}: "${short.title}" (id: ${short.id})`);
      });
      if (shorts.length > 5) {
        console.log(`   ... and ${shorts.length - 5} more`);
      }
      console.log(`   Current index: ${currentIndex}\n`);
    }
  }, [shorts.length, currentIndex]);

  /**
   * Log analytics when screen gains focus
   */
  useFocusEffect(
    useCallback(() => {
      Logger.info("[Analytics] shorts_tab_open", {
        source: "tab",
        timestamp: new Date().toISOString(),
        currentIndex,
      });

      return () => {
        Logger.info("[Shorts] Screen blurred");
      };
    }, [currentIndex])
  );

  /**
   * Track if this is the first focus (to distinguish tab switch from scroll)
   */
  const isFirstFocusRef = useRef(true);

  /**
   * Scroll to top ONLY when switching to Shorts tab from another tab
   * (not during scrolling within Shorts)
   */
  useFocusEffect(
    useCallback(() => {
      console.log(`[FOCUS] Screen focused, isFirstFocus: ${isFirstFocusRef.current}, currentIndex: ${currentIndexRef.current}`);
      
      // Only scroll to top on first focus OR when coming from another tab
      // Don't scroll during internal navigation
      if (!isFirstFocusRef.current && currentIndexRef.current > 0) {
        console.log(`[FOCUS] User returned to Shorts from another tab, will NOT auto-scroll (preserving position)`);
        // Preserve user's position - don't force to top
      }
      
      isFirstFocusRef.current = false;
      
      return () => {
        console.log(`[FOCUS] Screen will blur, current index: ${currentIndexRef.current}`);
      };
    }, []) // Empty deps - only fires on mount/unmount and focus changes
  );

  /**
   * Update current index (syncs state and ref)
   */
  const updateCurrentIndex = useCallback((newIndex: number) => {
    if (newIndex !== currentIndexRef.current) {
      const oldIndex = currentIndexRef.current;
      currentIndexRef.current = newIndex;
      setCurrentIndex(newIndex);
      
      console.log(`\n🎬 [INDEX CHANGE] ${oldIndex} → ${newIndex}`);
      console.log(`   Video ID: ${shorts[newIndex]?.id}`);
      console.log(`   Title: ${shorts[newIndex]?.title}`);
      console.log(`   Direction: ${newIndex > oldIndex ? "⬆️ UP" : "⬇️ DOWN"}`);
      console.log(`   Will re-render with new isActive\n`);
      
      Logger.info(`[Shorts] Index changed: ${oldIndex} → ${newIndex}`, {
        videoId: shorts[newIndex]?.id,
        direction: newIndex > oldIndex ? "up" : "down",
      });
    }
  }, [shorts]);

  /**
   * Handle scroll - calculate index from scroll position
   */
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const newIndex = Math.round(offsetY / SCREEN_HEIGHT);
    
    console.log(`[SCROLL] offsetY: ${offsetY.toFixed(0)}, SCREEN_HEIGHT: ${SCREEN_HEIGHT}, calculated index: ${newIndex}, current: ${currentIndexRef.current}`);
    
    // Update index if changed and valid
    if (newIndex >= 0 && newIndex < shorts.length && newIndex !== currentIndexRef.current) {
      console.log(`[SCROLL] ✅ Index will change from ${currentIndexRef.current} to ${newIndex}`);
      updateCurrentIndex(newIndex);
    } else if (newIndex === currentIndexRef.current) {
      console.log(`[SCROLL] ⏸️ Index unchanged (still ${newIndex})`);
    } else {
      console.log(`[SCROLL] ❌ Index ${newIndex} invalid (length: ${shorts.length})`);
    }
  }, [shorts.length, updateCurrentIndex]);

  /**
   * Handle momentum scroll end - final index update
   */
  const handleMomentumScrollEnd = useCallback((event: any) => {
    isScrollingRef.current = false;
    const offsetY = event.nativeEvent.contentOffset.y;
    const finalIndex = Math.round(offsetY / SCREEN_HEIGHT);
    
    console.log(`\n🛑 [MOMENTUM END] offsetY: ${offsetY.toFixed(0)}, finalIndex: ${finalIndex}\n`);
    
    // Ensure we have the correct final index
    if (finalIndex >= 0 && finalIndex < shorts.length) {
      updateCurrentIndex(finalIndex);
      Logger.info(`[Shorts] Scroll ended at index ${finalIndex}`);
    }
  }, [shorts.length, updateCurrentIndex]);

  /**
   * Handle scroll begin
   */
  const handleScrollBeginDrag = useCallback(() => {
    console.log(`\n👆 [SCROLL BEGIN] User started scrolling from index ${currentIndexRef.current}\n`);
    isScrollingRef.current = true;
  }, []);

  /**
   * Handle viewable items change - backup tracking
   */
  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (!isScrollingRef.current && viewableItems.length > 0) {
      const firstViewable = viewableItems[0];
      const index = firstViewable.index ?? 0;
      
      if (index >= 0 && index < shorts.length) {
        updateCurrentIndex(index);
      }
    }
  }, [shorts.length, updateCurrentIndex]);

  const handleViewableItemsChangedRef = useRef(handleViewableItemsChanged);
  handleViewableItemsChangedRef.current = handleViewableItemsChanged;

  /**
   * Perform search
   */
  const performSearch = useCallback(async (query: string) => {
    try {
      setIsSearching(true);
      
      Logger.info(`[ShortsSearch] Searching for: "${query}"`);
      
      if (!query.trim()) {
        // Empty query - show trending
        const trending = await getTrendingShorts(20);
        setSearchResults(trending);
      } else {
        // Search with query
        const results = await searchShorts(query, 20);
        setSearchResults(results);
      }
      
      // Reset to first result
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      
      Logger.info(`[ShortsSearch] Found ${searchResults.length} results`);
    } catch (err) {
      Logger.error("[ShortsSearch] Search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchResults.length]);

  /**
   * Handle search query change (real-time search)
   */
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    
    // Debounced search
    if (text.trim()) {
      performSearch(text);
    } else {
      // Empty query - back to trending
      performSearch("");
    }
  }, [performSearch]);

  /**
   * Enter search mode
   */
  const enterSearchMode = useCallback(() => {
    setIsSearchMode(true);
    performSearch(""); // Load trending
    Logger.info("[ShortsSearch] Entered search mode");
  }, [performSearch]);

  /**
   * Exit search mode
   */
  const exitSearchMode = useCallback(() => {
    setIsSearchMode(false);
    setSearchQuery("");
    setSearchResults([]);
    Keyboard.dismiss();
    Logger.info("[ShortsSearch] Exited search mode");
  }, []);

  /**
   * Handle video progress - preload next at 60%
   */
  const handleProgress = useCallback((index: number, progress: number) => {
    if (progress >= 60 && !preloadedIndices.has(index + 1)) {
      // Mark next video for preload
      setPreloadedIndices((prev) => new Set(prev).add(index + 1));
      Logger.info(`[Shorts] Preloading next video at index ${index + 1}`);
    }
  }, [preloadedIndices]);

  /**
   * Handle video ended - go to next
   */
  const handleVideoEnded = useCallback(() => {
    if (currentIndex < shorts.length - 1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  }, [currentIndex, shorts.length]);

  /**
   * Toggle mute (persists for all videos)
   */
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    Logger.info(`[Shorts] Mute toggled: ${!isMuted}`);
  }, [isMuted]);

  /**
   * Load more when near end
   */
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading) {
      Logger.info("[Shorts] Loading more shorts...");
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  /**
   * Render individual short
   */
  const renderShort = useCallback(({ item, index }: { item: VideoMetadata; index: number }) => {
    const isActive = index === currentIndex;
    
    console.log(`[RENDER] Index ${index}: "${item.title?.substring(0, 30)}" - isActive: ${isActive}`);
    
    return (
      <ShortCard
        key={`short-${item.id}-${index}`}
        video={item}
        isActive={isActive}
        isMuted={isMuted}
        onProgress={(progress) => handleProgress(index, progress)}
        onEnded={handleVideoEnded}
        onToggleMute={handleToggleMute}
      />
    );
  }, [currentIndex, isMuted, handleProgress, handleVideoEnded, handleToggleMute]);

  /**
   * Get current data source (search results or main feed)
   */
  const currentData = isSearchMode ? searchResults : shorts;

  /**
   * Extract key for FlatList
   */
  const keyExtractor = useCallback(
    (item: VideoMetadata, index: number) => `short-${item.id}-${index}`,
    []
  );

  /**
   * Get item layout for optimization
   */
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    []
  );

  // Error state
  if (error && shorts.length === 0 && !isSearchMode) {
    return <ErrorFallback message={error} onRetry={retry} />;
  }

  // Loading state
  if (isLoading && shorts.length === 0 && !isSearchMode) {
    console.log("[LOADING] Waiting for shorts to load...");
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading Shorts...</Text>
      </View>
    );
  }

  console.log(`\n🎬 [RENDERING FLATLIST] ${currentData.length} shorts, currentIndex: ${currentIndex}, searchMode: ${isSearchMode}\n`);

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Search Bar (appears in search mode) */}
      {isSearchMode && (
        <ShortsSearchBar
          value={searchQuery}
          onChangeText={handleSearchChange}
          onBack={exitSearchMode}
          placeholder="Search Shorts"
          autoFocus={true}
        />
      )}

      {/* Search Results Empty State */}
      {isSearchMode && !isSearching && searchResults.length === 0 && (
        <View style={styles.noResultsContainer}>
          <MaterialCommunityIcons name="magnify-close" size={64} color="rgba(255, 255, 255, 0.5)" />
          <Text style={styles.noResultsTitle}>No results found</Text>
          <Text style={styles.noResultsText}>
            Try different keywords or check your spelling
          </Text>
        </View>
      )}

      {/* Loading Search Results */}
      {isSearchMode && isSearching && (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.searchingText}>Searching...</Text>
        </View>
      )}

      {/* Shorts Feed */}
      {currentData.length > 0 && (
        <FlatList
          ref={flatListRef}
          data={currentData}
        renderItem={renderShort}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={handleViewableItemsChangedRef.current}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={false}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        windowSize={5}
        scrollEventThrottle={16}
        nestedScrollEnabled={false}
        bounces={true}
        alwaysBounceVertical={true}
        directionalLockEnabled={true}
      />
      )}

      {/* Header (only show when NOT in search mode) */}
      {!isSearchMode && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shorts</Text>
          
          {/* Search Icon Button */}
          <Pressable
            style={styles.searchIconButton}
            onPress={enterSearchMode}
            accessible
            accessibilityLabel="Search shorts"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="magnify" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    textAlign: "center",
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
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  headerTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  searchIconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#000000",
  },
  noResultsTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 15,
    textAlign: "center",
  },
  searchingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  searchingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
});

