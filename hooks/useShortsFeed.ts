/**
 * hooks/useShortsFeed.ts
 * 
 * Custom hook for managing shorts feed data
 * - Fetch shorts from API
 * - Pagination support
 * - Preload next page
 * - Error handling and retry
 * 
 * Production-ready with defensive programming
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { fetchVideoFeed } from "../services/videoService";
import type { VideoMetadata } from "../types/video";
import Logger from "../utils/Logger";

interface UseShortsFeedReturn {
  shorts: VideoMetadata[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadInitial: () => Promise<void>;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
}

/**
 * Hook to manage shorts feed with pagination
 */
export function useShortsFeed(): UseShortsFeedReturn {
  const [shorts, setShorts] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const currentPageRef = useRef(0);
  const isLoadingRef = useRef(false);

  /**
   * Load initial shorts
   */
  const loadInitial = useCallback(async () => {
    if (isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      Logger.info("[ShortsFeed] Loading initial shorts...");

      const response = await fetchVideoFeed(0, 10);

      if (!response || !response.videos) {
        throw new Error("Invalid response from video service");
      }

      // Filter for short videos only (≤60 seconds)
      const shortVideos = response.videos.filter((v) => v.duration <= 60);

      if (shortVideos.length === 0) {
        throw new Error("No short videos available");
      }

      setShorts(shortVideos);
      setHasMore(response.hasMore ?? false);
      currentPageRef.current = 0;

      Logger.info(`[ShortsFeed] Loaded ${shortVideos.length} shorts`);
    } catch (err) {
      Logger.error("[ShortsFeed] Failed to load initial shorts:", err);
      setError(err instanceof Error ? err.message : "Failed to load shorts");
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  /**
   * Load more shorts (pagination)
   */
  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMore || isLoadingMore) {
      return;
    }

    try {
      isLoadingRef.current = true;
      setIsLoadingMore(true);

      const nextPage = currentPageRef.current + 1;
      Logger.info(`[ShortsFeed] Loading more shorts, page ${nextPage}...`);

      const response = await fetchVideoFeed(nextPage, 10);

      if (!response || !response.videos) {
        throw new Error("Invalid response from video service");
      }

      // Filter for short videos
      const shortVideos = response.videos.filter((v) => v.duration <= 60);

      setShorts((prev) => [...prev, ...shortVideos]);
      setHasMore(response.hasMore ?? false);
      currentPageRef.current = nextPage;

      Logger.info(`[ShortsFeed] Loaded ${shortVideos.length} more shorts`);
    } catch (err) {
      Logger.error("[ShortsFeed] Failed to load more shorts:", err);
      // Don't set error for pagination failures, just log
    } finally {
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [hasMore, isLoadingMore]);

  /**
   * Retry after error
   */
  const retry = useCallback(async () => {
    Logger.info("[ShortsFeed] Retrying...");
    currentPageRef.current = 0;
    setShorts([]);
    await loadInitial();
  }, [loadInitial]);

  /**
   * Load initial shorts on mount
   */
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    shorts,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadInitial,
    loadMore,
    retry,
  };
}

export default useShortsFeed;

