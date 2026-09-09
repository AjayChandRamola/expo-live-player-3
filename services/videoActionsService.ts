/**
 * services/videoActionsService.ts
 * 
 * Backend-agnostic service layer for video actions
 * - Like, Dislike, Share, Download, Clip, Save, Report
 * - Prepared for AWS, REST, GraphQL, Supabase, Firebase, etc.
 * - Mock implementation with retry logic
 * 
 * Production-ready with comprehensive error handling
 */

import Logger from "../utils/Logger";

/**
 * Video action types
 */
export type VideoActionType = "like" | "dislike" | "share" | "download" | "clip" | "save" | "report";

/**
 * Like/Dislike response
 */
export interface LikeDislikeResponse {
  liked: boolean;
  disliked: boolean;
  likes: number;
  dislikes: number;
}

/**
 * Share response
 */
export interface ShareResponse {
  shareUrl: string;
  shareCount: number;
}

/**
 * Download response
 */
export interface DownloadResponse {
  downloadId: string;
  status: "pending" | "downloading" | "completed" | "failed";
  progress?: number;
}

/**
 * Clip response
 */
export interface ClipResponse {
  clipId: string;
  clipUrl: string;
}

/**
 * Save response
 */
export interface SaveResponse {
  saved: boolean;
  playlistIds: string[];
}

/**
 * Report response
 */
export interface ReportResponse {
  reported: boolean;
}

/**
 * Playlist info
 */
export interface PlaylistInfo {
  id: string;
  name: string;
  videoCount: number;
  thumbnailUrl?: string;
}

/**
 * Simulate network delay
 */
const simulateNetworkDelay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry helper
 */
const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        Logger.warn(`[VideoActionsService] Retry ${i + 1}/${maxRetries}`, lastError.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error("Unknown error");
};

/**
 * Mock state (in real app, this would be a backend)
 */
const mockVideoState: Record<string, {
  liked: boolean;
  disliked: boolean;
  likes: number;
  dislikes: number;
  shareCount: number;
  savedPlaylists: string[];
}> = {};

/**
 * Video Actions Service
 * 
 * Backend-ready abstraction layer for all video actions
 */
export const videoActionsService = {
  /**
   * Like a video
   */
  async like(videoId: string): Promise<LikeDislikeResponse> {
    return retry(async () => {
      await simulateNetworkDelay(200);
      
      if (!mockVideoState[videoId]) {
        mockVideoState[videoId] = {
          liked: false,
          disliked: false,
          likes: 0,
          dislikes: 0,
          shareCount: 0,
          savedPlaylists: [],
        };
      }

      const state = mockVideoState[videoId];
      state.liked = !state.liked;
      state.disliked = false; // Mutually exclusive
      
      if (state.liked) {
        state.likes++;
        if (state.dislikes > 0) state.dislikes--;
      } else {
        state.likes = Math.max(0, state.likes - 1);
      }

      Logger.info(`[VideoActionsService] Like toggled for ${videoId}`, {
        liked: state.liked,
        likes: state.likes,
      });

      return {
        liked: state.liked,
        disliked: state.disliked,
        likes: state.likes,
        dislikes: state.dislikes,
      };
    });
  },

  /**
   * Dislike a video
   */
  async dislike(videoId: string): Promise<LikeDislikeResponse> {
    return retry(async () => {
      await simulateNetworkDelay(200);
      
      if (!mockVideoState[videoId]) {
        mockVideoState[videoId] = {
          liked: false,
          disliked: false,
          likes: 0,
          dislikes: 0,
          shareCount: 0,
          savedPlaylists: [],
        };
      }

      const state = mockVideoState[videoId];
      state.disliked = !state.disliked;
      state.liked = false; // Mutually exclusive
      
      if (state.disliked) {
        state.dislikes++;
        if (state.likes > 0) state.likes--;
      } else {
        state.dislikes = Math.max(0, state.dislikes - 1);
      }

      Logger.info(`[VideoActionsService] Dislike toggled for ${videoId}`, {
        disliked: state.disliked,
        dislikes: state.dislikes,
      });

      return {
        liked: state.liked,
        disliked: state.disliked,
        likes: state.likes,
        dislikes: state.dislikes,
      };
    });
  },

  /**
   * Get like/dislike state
   */
  async getLikeDislikeState(videoId: string): Promise<LikeDislikeResponse> {
    await simulateNetworkDelay(100);
    
    const state = mockVideoState[videoId] || {
      liked: false,
      disliked: false,
      likes: 0,
      dislikes: 0,
      shareCount: 0,
      savedPlaylists: [],
    };

    return {
      liked: state.liked,
      disliked: state.disliked,
      likes: state.likes,
      dislikes: state.dislikes,
    };
  },

  /**
   * Share a video
   */
  async share(videoId: string, shareData?: { title?: string; url?: string }): Promise<ShareResponse> {
    return retry(async () => {
      await simulateNetworkDelay(300);
      
      if (!mockVideoState[videoId]) {
        mockVideoState[videoId] = {
          liked: false,
          disliked: false,
          likes: 0,
          dislikes: 0,
          shareCount: 0,
          savedPlaylists: [],
        };
      }

      mockVideoState[videoId].shareCount++;

      Logger.info(`[VideoActionsService] Video shared ${videoId}`, {
        shareCount: mockVideoState[videoId].shareCount,
      });

      return {
        shareUrl: shareData?.url || `https://example.com/video/${videoId}`,
        shareCount: mockVideoState[videoId].shareCount,
      };
    });
  },

  /**
   * Download a video
   */
  async download(videoId: string): Promise<DownloadResponse> {
    return retry(async () => {
      await simulateNetworkDelay(500);
      
      Logger.info(`[VideoActionsService] Download started for ${videoId}`);

      // In real app, this would initiate actual download
      // For now, return pending status
      return {
        downloadId: `download_${Date.now()}`,
        status: "pending",
        progress: 0,
      };
    });
  },

  /**
   * Create a clip
   */
  async createClip(
    videoId: string,
    startTime: number,
    endTime: number
  ): Promise<ClipResponse> {
    return retry(async () => {
      await simulateNetworkDelay(1000);
      
      Logger.info(`[VideoActionsService] Clip created for ${videoId}`, {
        startTime,
        endTime,
      });

      return {
        clipId: `clip_${Date.now()}`,
        clipUrl: `https://example.com/clip/${videoId}/${startTime}-${endTime}`,
      };
    });
  },

  /**
   * Get playlists
   */
  async getPlaylists(): Promise<PlaylistInfo[]> {
    await simulateNetworkDelay(200);
    
    // Mock playlists
    return [
      { id: "playlist1", name: "Watch Later", videoCount: 5 },
      { id: "playlist2", name: "Favorites", videoCount: 12 },
      { id: "playlist3", name: "Music", videoCount: 23 },
    ];
  },

  /**
   * Save video to playlist(s)
   */
  async saveToPlaylist(videoId: string, playlistIds: string[]): Promise<SaveResponse> {
    return retry(async () => {
      await simulateNetworkDelay(300);
      
      if (!mockVideoState[videoId]) {
        mockVideoState[videoId] = {
          liked: false,
          disliked: false,
          likes: 0,
          dislikes: 0,
          shareCount: 0,
          savedPlaylists: [],
        };
      }

      mockVideoState[videoId].savedPlaylists = playlistIds;

      Logger.info(`[VideoActionsService] Video saved to playlists ${videoId}`, {
        playlistIds,
      });

      return {
        saved: playlistIds.length > 0,
        playlistIds,
      };
    });
  },

  /**
   * Get saved playlists for video
   */
  async getSavedPlaylists(videoId: string): Promise<string[]> {
    await simulateNetworkDelay(100);
    
    const state = mockVideoState[videoId];
    return state?.savedPlaylists || [];
  },

  /**
   * Report a video
   */
  async report(videoId: string, reason: string, details?: string): Promise<ReportResponse> {
    return retry(async () => {
      await simulateNetworkDelay(200);
      
      Logger.info(`[VideoActionsService] Video reported ${videoId}`, {
        reason,
        details,
      });

      return {
        reported: true,
      };
    });
  },

  /**
   * Not interested
   */
  async notInterested(videoId: string): Promise<void> {
    return retry(async () => {
      await simulateNetworkDelay(200);
      
      Logger.info(`[VideoActionsService] Not interested in ${videoId}`);
    });
  },

  /**
   * Don't recommend channel
   */
  async dontRecommendChannel(channelId: string): Promise<void> {
    return retry(async () => {
      await simulateNetworkDelay(200);
      
      Logger.info(`[VideoActionsService] Don't recommend channel ${channelId}`);
    });
  },
};

