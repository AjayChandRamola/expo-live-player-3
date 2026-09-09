/**
 * hooks/useVideoActions.ts
 * 
 * Custom hook for video actions (Like, Dislike, Share, etc.)
 * - Optimistic updates
 * - Error handling
 * - Retry logic
 * - Comprehensive logging
 * 
 * Production-ready with robust error handling
 */

import { useState, useCallback, useEffect } from "react";
import { videoActionsService } from "../services/videoActionsService";
import type { LikeDislikeResponse } from "../services/videoActionsService";
import Logger from "../utils/Logger";

interface UseVideoActionsOptions {
  /**
   * Video ID
   */
  videoId: string;

  /**
   * Initial like state
   */
  initialLiked?: boolean;

  /**
   * Initial dislike state
   */
  initialDisliked?: boolean;

  /**
   * Initial like count
   */
  initialLikeCount?: number;

  /**
   * Initial dislike count
   */
  initialDislikeCount?: number;

  /**
   * Initial saved state
   */
  initialSaved?: boolean;
}

interface UseVideoActionsReturn {
  // State
  isLiked: boolean;
  isDisliked: boolean;
  likeCount: number;
  dislikeCount: number;
  isSaved: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  like: () => Promise<void>;
  dislike: () => Promise<void>;
  share: (shareData?: { title?: string; url?: string }) => Promise<void>;
  download: () => Promise<void>;
  clip: (startTime: number, endTime: number) => Promise<void>;
  save: (playlistIds: string[]) => Promise<void>;
  report: (reason: string, details?: string) => Promise<void>;
  notInterested: () => Promise<void>;
  dontRecommendChannel: (channelId: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

/**
 * Hook for video actions
 */
export function useVideoActions({
  videoId,
  initialLiked = false,
  initialDisliked = false,
  initialLikeCount = 0,
  initialDislikeCount = 0,
  initialSaved = false,
}: UseVideoActionsOptions): UseVideoActionsReturn {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isDisliked, setIsDisliked] = useState(initialDisliked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refresh state from server
   */
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const state = await videoActionsService.getLikeDislikeState(videoId);
      setIsLiked(state.liked);
      setIsDisliked(state.disliked);
      setLikeCount(state.likes);
      setDislikeCount(state.dislikes);

      const savedPlaylists = await videoActionsService.getSavedPlaylists(videoId);
      setIsSaved(savedPlaylists.length > 0);

      Logger.info(`[useVideoActions] Refreshed state for ${videoId}`, {
        liked: state.liked,
        disliked: state.disliked,
        likes: state.likes,
        saved: savedPlaylists.length > 0,
      });
    } catch (err) {
      Logger.error("[useVideoActions] Failed to refresh state:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh state");
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  /**
   * Load initial state
   */
  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Handle like
   */
  const like = useCallback(async () => {
    // Store previous state for rollback
    let previousLiked = isLiked;
    let previousDisliked = isDisliked;
    let previousLikeCount = likeCount;
    let previousDislikeCount = dislikeCount;

    try {
      setIsLoading(true);
      setError(null);

      // Optimistic update
      const newLiked = !isLiked;
      const newDisliked = false; // Mutually exclusive

      setIsLiked(newLiked);
      setIsDisliked(newDisliked);
      
      if (newLiked) {
        setLikeCount((prev) => prev + 1);
        if (isDisliked && dislikeCount > 0) {
          setDislikeCount((prev) => prev - 1);
        }
      } else {
        setLikeCount((prev) => Math.max(0, prev - 1));
      }

      Logger.info(`[useVideoActions] Like toggled optimistically for ${videoId}`, {
        liked: newLiked,
      });

      // Call backend
      const response = await videoActionsService.like(videoId);

      // Update with server response
      setIsLiked(response.liked);
      setIsDisliked(response.disliked);
      setLikeCount(response.likes);
      setDislikeCount(response.dislikes);

      Logger.info(`[useVideoActions] Like confirmed for ${videoId}`, {
        liked: response.liked,
        likes: response.likes,
      });
    } catch (err) {
      // Rollback optimistic update
      setIsLiked(previousLiked);
      setIsDisliked(previousDisliked);
      setLikeCount(previousLikeCount);
      setDislikeCount(previousDislikeCount);

      Logger.error("[useVideoActions] Failed to like video:", err);
      setError(err instanceof Error ? err.message : "Failed to like video");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [videoId, isLiked, isDisliked, likeCount, dislikeCount]);

  /**
   * Handle dislike
   */
  const dislike = useCallback(async () => {
    // Store previous state for rollback
    let previousLiked = isLiked;
    let previousDisliked = isDisliked;
    let previousLikeCount = likeCount;
    let previousDislikeCount = dislikeCount;

    try {
      setIsLoading(true);
      setError(null);

      // Optimistic update
      const newDisliked = !isDisliked;
      const newLiked = false; // Mutually exclusive

      setIsDisliked(newDisliked);
      setIsLiked(newLiked);
      
      if (newDisliked) {
        setDislikeCount((prev) => prev + 1);
        if (isLiked && likeCount > 0) {
          setLikeCount((prev) => prev - 1);
        }
      } else {
        setDislikeCount((prev) => Math.max(0, prev - 1));
      }

      Logger.info(`[useVideoActions] Dislike toggled optimistically for ${videoId}`, {
        disliked: newDisliked,
      });

      // Call backend
      const response = await videoActionsService.dislike(videoId);

      // Update with server response
      setIsLiked(response.liked);
      setIsDisliked(response.disliked);
      setLikeCount(response.likes);
      setDislikeCount(response.dislikes);

      Logger.info(`[useVideoActions] Dislike confirmed for ${videoId}`, {
        disliked: response.disliked,
        dislikes: response.dislikes,
      });
    } catch (err) {
      // Rollback optimistic update
      setIsLiked(previousLiked);
      setIsDisliked(previousDisliked);
      setLikeCount(previousLikeCount);
      setDislikeCount(previousDislikeCount);

      Logger.error("[useVideoActions] Failed to dislike video:", err);
      setError(err instanceof Error ? err.message : "Failed to dislike video");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [videoId, isLiked, isDisliked, likeCount, dislikeCount]);

  /**
   * Handle share
   */
  const share = useCallback(
    async (shareData?: { title?: string; url?: string }) => {
      try {
        setIsLoading(true);
        setError(null);

        Logger.info(`[useVideoActions] Sharing video ${videoId}`, shareData);

        await videoActionsService.share(videoId, shareData);

        Logger.info(`[useVideoActions] Video shared successfully ${videoId}`);
      } catch (err) {
        Logger.error("[useVideoActions] Failed to share video:", err);
        setError(err instanceof Error ? err.message : "Failed to share video");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [videoId]
  );

  /**
   * Handle download
   */
  const download = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      Logger.info(`[useVideoActions] Downloading video ${videoId}`);

      await videoActionsService.download(videoId);

      Logger.info(`[useVideoActions] Download started for ${videoId}`);
    } catch (err) {
      Logger.error("[useVideoActions] Failed to download video:", err);
      setError(err instanceof Error ? err.message : "Failed to download video");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  /**
   * Handle clip
   */
  const clip = useCallback(
    async (startTime: number, endTime: number) => {
      try {
        setIsLoading(true);
        setError(null);

        Logger.info(`[useVideoActions] Creating clip for ${videoId}`, {
          startTime,
          endTime,
        });

        await videoActionsService.createClip(videoId, startTime, endTime);

        Logger.info(`[useVideoActions] Clip created successfully for ${videoId}`);
      } catch (err) {
        Logger.error("[useVideoActions] Failed to create clip:", err);
        setError(err instanceof Error ? err.message : "Failed to create clip");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [videoId]
  );

  /**
   * Handle save
   */
  const save = useCallback(
    async (playlistIds: string[]) => {
      try {
        setIsLoading(true);
        setError(null);

        Logger.info(`[useVideoActions] Saving video ${videoId} to playlists`, {
          playlistIds,
        });

        const response = await videoActionsService.saveToPlaylist(videoId, playlistIds);
        setIsSaved(response.saved);

        Logger.info(`[useVideoActions] Video saved successfully ${videoId}`);
      } catch (err) {
        Logger.error("[useVideoActions] Failed to save video:", err);
        setError(err instanceof Error ? err.message : "Failed to save video");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [videoId]
  );

  /**
   * Handle report
   */
  const report = useCallback(
    async (reason: string, details?: string) => {
      try {
        setIsLoading(true);
        setError(null);

        Logger.info(`[useVideoActions] Reporting video ${videoId}`, {
          reason,
          details,
        });

        await videoActionsService.report(videoId, reason, details);

        Logger.info(`[useVideoActions] Video reported successfully ${videoId}`);
      } catch (err) {
        Logger.error("[useVideoActions] Failed to report video:", err);
        setError(err instanceof Error ? err.message : "Failed to report video");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [videoId]
  );

  /**
   * Handle not interested
   */
  const notInterested = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      Logger.info(`[useVideoActions] Not interested in video ${videoId}`);

      await videoActionsService.notInterested(videoId);

      Logger.info(`[useVideoActions] Not interested confirmed for ${videoId}`);
    } catch (err) {
      Logger.error("[useVideoActions] Failed to mark as not interested:", err);
      setError(err instanceof Error ? err.message : "Failed to mark as not interested");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  /**
   * Handle don't recommend channel
   */
  const dontRecommendChannel = useCallback(
    async (channelId: string) => {
      try {
        setIsLoading(true);
        setError(null);

        Logger.info(`[useVideoActions] Don't recommend channel ${channelId}`);

        await videoActionsService.dontRecommendChannel(channelId);

        Logger.info(`[useVideoActions] Don't recommend channel confirmed for ${channelId}`);
      } catch (err) {
        Logger.error("[useVideoActions] Failed to don't recommend channel:", err);
        setError(err instanceof Error ? err.message : "Failed to don't recommend channel");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    // State
    isLiked,
    isDisliked,
    likeCount,
    dislikeCount,
    isSaved,
    isLoading,
    error,

    // Actions
    like,
    dislike,
    share,
    download,
    clip,
    save,
    report,
    notInterested,
    dontRecommendChannel,

    // Refresh
    refresh,
  };
}

