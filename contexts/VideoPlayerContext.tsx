/**
 * contexts/VideoPlayerContext.tsx
 *
 * Global state management for video player synchronization
 * - Maintains video list from Home feed
 * - Tracks current playing video
 * - Handles autoplay settings
 * - Syncs Home ↔ Player navigation
 *
 * Production-ready with TypeScript, logging, and defensive programming
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";

import type { VideoMetadata } from "../types/video";
import Logger from "../utils/Logger";

interface VideoPlayerState {
  videoList: VideoMetadata[];
  currentIndex: number;
  currentVideo: VideoMetadata | null;

  isAutoplayEnabled: boolean;

  homeScrollPosition: number;
}

interface VideoPlayerContextValue extends VideoPlayerState {
  setVideoList: (videos: VideoMetadata[]) => void;
  playVideoAtIndex: (index: number) => void;
  playVideoById: (id: string) => void;
  playNext: () => boolean;
  playPrevious: () => boolean;
  toggleAutoplay: () => void;
  setAutoplay: (enabled: boolean) => void;
  saveHomeScrollPosition: (position: number) => void;

  hasNext: boolean;
  hasPrevious: boolean;
  nextVideo: VideoMetadata | null;
  previousVideo: VideoMetadata | null;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | undefined>(
  undefined
);

interface VideoPlayerProviderProps {
  children: ReactNode;
}

/**
 * VideoPlayerProvider
 * Wraps the entire app from app/_layout.tsx
 */
export const VideoPlayerProvider: React.FC<VideoPlayerProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<VideoPlayerState>({
    videoList: [],
    currentIndex: -1,
    currentVideo: null,
    isAutoplayEnabled: true,
    homeScrollPosition: 0,
  });

  // Log provider mount (NOT inside JSX)
  useEffect(() => {
    Logger.info("[VideoPlayerProvider] mounted");
    return () => {
      Logger.info("[VideoPlayerProvider] unmounted");
    };
  }, []);

  /**
   * Update video list
   */
  const setVideoList = useCallback((videos: VideoMetadata[]) => {
    if (!Array.isArray(videos)) {
      Logger.error("[VideoContext] Invalid video list provided");
      return;
    }

    setState((prev) => {
      if (prev.videoList.length === videos.length) {
        const prevIds = prev.videoList.map((v) => v.id).join(",");
        const newIds = videos.map((v) => v.id).join(",");
        if (prevIds === newIds) {
          return prev;
        }
      }

      Logger.info(`[VideoContext] Video list updated: ${videos.length} videos`);
      return { ...prev, videoList: videos };
    });
  }, []);

  /**
   * Play video at index
   */
  const playVideoAtIndex = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.videoList.length) {
        Logger.warn(`[VideoContext] Invalid index: ${index}`);
        return prev;
      }

      const video = prev.videoList[index];
      Logger.info(
        `[VideoContext] Playing video at index ${index}: "${video.title}"`
      );

      return {
        ...prev,
        currentIndex: index,
        currentVideo: video,
      };
    });
  }, []);

  /**
   * Play video by ID
   */
  const playVideoById = useCallback((id: string) => {
    setState((prev) => {
      const index = prev.videoList.findIndex((v) => v.id === id);

      if (index === -1) {
        Logger.warn(`[VideoContext] Video ID not found: ${id}`);
        return prev;
      }

      const video = prev.videoList[index];
      Logger.info(
        `[VideoContext] Playing video by ID "${id}": "${video.title}"`
      );

      return {
        ...prev,
        currentIndex: index,
        currentVideo: video,
      };
    });
  }, []);

  /**
   * Play next video
   */
  const playNext = useCallback((): boolean => {
    let success = false;

    setState((prev) => {
      const nextIndex = prev.currentIndex + 1;

      if (nextIndex >= prev.videoList.length) {
        Logger.info("[VideoContext] No next video available (end of list)");
        return prev;
      }

      const video = prev.videoList[nextIndex];
      Logger.info(`[VideoContext] Playing next video: "${video.title}"`);
      success = true;

      return {
        ...prev,
        currentIndex: nextIndex,
        currentVideo: video,
      };
    });

    return success;
  }, []);

  /**
   * Play previous video
   */
  const playPrevious = useCallback((): boolean => {
    let success = false;

    setState((prev) => {
      const prevIndex = prev.currentIndex - 1;

      if (prevIndex < 0) {
        Logger.info("[VideoContext] No previous video available (start of list)");
        return prev;
      }

      const video = prev.videoList[prevIndex];
      Logger.info(`[VideoContext] Playing previous video: "${video.title}"`);
      success = true;

      return {
        ...prev,
        currentIndex: prevIndex,
        currentVideo: video,
      };
    });

    return success;
  }, []);

  /**
   * Toggle autoplay
   */
  const toggleAutoplay = useCallback(() => {
    setState((prev) => {
      const newValue = !prev.isAutoplayEnabled;

      Logger.info(
        `[VideoContext] Autoplay ${newValue ? "enabled" : "disabled"}`
      );

      return {
        ...prev,
        isAutoplayEnabled: newValue,
      };
    });
  }, []);

  /**
   * Set autoplay explicitly
   */
  const setAutoplay = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      isAutoplayEnabled: enabled,
    }));
    Logger.info(`[VideoContext] Autoplay set to: ${enabled}`);
  }, []);

  /**
   * Save HomeScrollPosition
   */
  const saveHomeScrollPosition = useCallback((position: number) => {
    setState((prev) => ({
      ...prev,
      homeScrollPosition: Math.max(0, position),
    }));
  }, []);

  // Computed values
  const hasNext = state.currentIndex < state.videoList.length - 1;
  const hasPrevious = state.currentIndex > 0;
  const nextVideo = hasNext
    ? state.videoList[state.currentIndex + 1]
    : null;
  const previousVideo = hasPrevious
    ? state.videoList[state.currentIndex - 1]
    : null;

  const value: VideoPlayerContextValue = {
    ...state,
    setVideoList,
    playVideoAtIndex,
    playVideoById,
    playNext,
    playPrevious,
    toggleAutoplay,
    setAutoplay,
    saveHomeScrollPosition,
    hasNext,
    hasPrevious,
    nextVideo,
    previousVideo,
  };

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
};

/**
 * Hook to access context safely
 */
export const useVideoPlayerContext = () => {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error(
      "useVideoPlayerContext must be used within VideoPlayerProvider"
    );
  }
  return context;
};

export default VideoPlayerContext;
