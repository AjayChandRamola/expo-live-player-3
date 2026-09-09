/**
 * hooks/useShortsPlayer.ts
 * 
 * Custom hook for managing individual short video playback
 * - Auto-play when visible
 * - Auto-pause when not visible
 * - Progress tracking
 * - Mute state management
 * - Error handling
 * 
 * Production-ready with defensive programming
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useVideoPlayer, VideoView } from "expo-video";
import Logger from "../utils/Logger";

interface UseShortsPlayerProps {
  videoUrl: string;
  isActive: boolean; // Is this short currently visible?
  isMuted: boolean;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  videoId: string;
}

interface UseShortsPlayerReturn {
  player: ReturnType<typeof useVideoPlayer> | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  progress: number;
  duration: number;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  retry: () => void;
}

/**
 * Hook to manage short video playback with auto-play/pause
 */
export function useShortsPlayer({
  videoUrl,
  isActive,
  isMuted,
  onProgress,
  onEnded,
  onError,
  videoId,
}: UseShortsPlayerProps): UseShortsPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoPlayedRef = useRef(false);

  // Create video player instance
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false; // Don't loop, go to next video
    player.muted = isMuted;
  });

  /**
   * Update mute state when prop changes
   */
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [player, isMuted]);

  /**
   * Play video
   */
  const play = useCallback(() => {
    if (!player || error) return;

    try {
      player.play();
      setIsPlaying(true);
      Logger.info(`[ShortsPlayer] Playing: ${videoId}`);
    } catch (err) {
      Logger.error(`[ShortsPlayer] Play failed for ${videoId}:`, err);
      setError("Failed to play video");
      onError?.(err as Error);
    }
  }, [player, error, videoId, onError]);

  /**
   * Pause video
   */
  const pause = useCallback(() => {
    if (!player) return;

    try {
      player.pause();
      setIsPlaying(false);
      Logger.info(`[ShortsPlayer] Paused: ${videoId}`);
    } catch (err) {
      Logger.error(`[ShortsPlayer] Pause failed for ${videoId}:`, err);
    }
  }, [player, videoId]);

  /**
   * Seek to specific time
   */
  const seek = useCallback((seconds: number) => {
    if (!player || !duration) return;

    try {
      const targetTime = Math.max(0, Math.min(seconds, duration));
      player.currentTime = targetTime;
      Logger.info(`[ShortsPlayer] Seeked to ${targetTime}s in ${videoId}`);
    } catch (err) {
      Logger.error(`[ShortsPlayer] Seek failed for ${videoId}:`, err);
    }
  }, [player, duration, videoId]);

  /**
   * Retry loading video
   */
  const retry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    hasAutoPlayedRef.current = false;
    
    if (player && isActive) {
      play();
    }
  }, [player, isActive, play]);

  /**
   * Track progress
   */
  useEffect(() => {
    if (!player || !isPlaying) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    // Update progress every 100ms for smooth bar
    progressIntervalRef.current = setInterval(() => {
      try {
        const currentTime = player.currentTime;
        const videoDuration = player.duration;

        if (videoDuration > 0) {
          const progressPercent = (currentTime / videoDuration) * 100;
          setProgress(progressPercent);
          setDuration(videoDuration);

          // Callback for preloading
          onProgress?.(progressPercent);

          // Check if ended
          if (currentTime >= videoDuration - 0.1) {
            setIsPlaying(false);
            onEnded?.();
          }
        }
      } catch (err) {
        // Silent fail for progress tracking
      }
    }, 100);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [player, isPlaying, onProgress, onEnded]);

  /**
   * Auto-play when becomes active, pause when not active
   */
  useEffect(() => {
    if (!player) return;

    console.log(`[PLAYER ${videoId}] isActive changed to: ${isActive}, hasAutoPlayed: ${hasAutoPlayedRef.current}, isPlaying: ${isPlaying}`);

    if (isActive) {
      // Video is now visible - auto-play
      if (!hasAutoPlayedRef.current) {
        console.log(`[PLAYER ${videoId}] 🎬 AUTO-PLAYING (first time visible)`);
        setIsLoading(false);
        play();
        hasAutoPlayedRef.current = true;
      } else {
        console.log(`[PLAYER ${videoId}] Already auto-played, currently ${isPlaying ? 'playing' : 'paused'}`);
      }
    } else {
      // Video scrolled away - pause
      console.log(`[PLAYER ${videoId}] ⏸️ Video scrolled away, pausing...`);
      if (isPlaying) {
        pause();
      }
      hasAutoPlayedRef.current = false;
      setProgress(0); // Reset progress
    }
  }, [isActive, player, isPlaying, play, pause, videoId]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (player) {
        try {
          player.pause();
        } catch {}
      }
    };
  }, [player]);

  return {
    player,
    isPlaying,
    isLoading,
    error,
    progress,
    duration,
    play,
    pause,
    seek,
    retry,
  };
}

export default useShortsPlayer;

