/**
 * hooks/useVideoProgress.ts
 * 
 * Custom hook for video progress tracking
 * - Real-time position updates
 * - Buffered position tracking
 * - Seek functionality
 * - Throttled updates for performance
 * 
 * Production-ready with performance optimization
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useVideoPlayer } from "expo-video";
import Logger from "../utils/Logger";

interface UseVideoProgressOptions {
  /**
   * Video player instance from useVideoPlayer
   */
  player: ReturnType<typeof useVideoPlayer> | null;

  /**
   * Whether video is playing
   */
  isPlaying: boolean;

  /**
   * Update interval in milliseconds (default: 250ms for smooth progress bar)
   */
  updateInterval?: number;
}

interface UseVideoProgressReturn {
  /**
   * Current position in milliseconds
   */
  position: number;

  /**
   * Total duration in milliseconds
   */
  duration: number;

  /**
   * Buffered position in milliseconds
   */
  buffered: number;

  /**
   * Whether video is loaded
   */
  isLoaded: boolean;

  /**
   * Seek to position
   */
  seek: (position: number) => Promise<void>;
}

/**
 * Hook for video progress tracking
 */
export function useVideoProgress({
  player,
  isPlaying,
  updateInterval = 250,
}: UseVideoProgressOptions): UseVideoProgressReturn {
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef(0);

  /**
   * Update progress from video player
   */
  const updateProgress = useCallback(() => {
    try {
      if (!player) {
        setIsLoaded(false);
        setPosition(0);
        setDuration(0);
        setBuffered(0);
        return;
      }

      const currentDuration = player.duration || 0;
      if (currentDuration > 0) {
        setIsLoaded(true);
        const currentPosition = (player.currentTime || 0) * 1000; // Convert to ms
        const currentDurationMs = currentDuration * 1000; // Convert to ms
        // expo-video doesn't have playableDurationMillis, use currentTime as buffered estimate
        const currentBuffered = currentPosition;

        setPosition(currentPosition);
        setDuration(currentDurationMs);
        setBuffered(currentBuffered);
      } else {
        setIsLoaded(false);
        setPosition(0);
        setDuration(0);
        setBuffered(0);
      }
    } catch (error) {
      Logger.error("[useVideoProgress] Failed to update progress:", error);
    }
  }, [player]);

  /**
   * Set up progress updates
   */
  useEffect(() => {
    if (!player) return;

    // Update immediately
    updateProgress();

    // Set up interval for regular updates
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= updateInterval) {
        lastUpdateRef.current = now;
        updateProgress();
      }
    }, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [player, isPlaying, updateInterval, updateProgress]);

  /**
   * Seek to position
   */
  const seek = useCallback(
    async (seekPosition: number) => {
      try {
        if (!player) {
          Logger.warn("[useVideoProgress] Player not available for seek");
          return;
        }

        const clampedPositionMs = Math.max(0, Math.min(seekPosition, duration));
        const clampedPositionSeconds = clampedPositionMs / 1000; // Convert to seconds

        Logger.info(`[useVideoProgress] Seeking to ${clampedPositionMs}ms`, {
          position: clampedPositionMs,
          duration,
        });

        player.currentTime = clampedPositionSeconds;

        // Update immediately after seek
        setPosition(clampedPositionMs);
        updateProgress();
      } catch (error) {
        Logger.error("[useVideoProgress] Seek failed:", error);
        throw error;
      }
    },
    [player, duration, updateProgress]
  );

  return {
    position,
    duration,
    buffered,
    isLoaded,
    seek,
  };
}

