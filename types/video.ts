/**
 * types/video.ts
 * 
 * Type definitions for video-related data structures
 * Used across the application for type safety
 */

export interface VideoMetadata {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number; // in seconds
  views: number;
  uploadedAt: string; // ISO date string
  channelName: string;
  channelAvatar?: string;
  channelId?: string;
  likes?: number;
  dislikes?: number;
  tags?: string[];
  captions?: CaptionItem[];
  chapters?: ChapterItem[];
}

export interface CaptionItem {
  start: number;
  end?: number | null;
  text: string;
}

export interface ChapterItem {
  title: string;
  startMs: number;
}

export interface VideoFeedResponse {
  videos: VideoMetadata[];
  nextPageToken?: string;
  hasMore: boolean;
}

export interface ChannelInfo {
  id: string;
  name: string;
  avatar?: string;
  subscribers?: number;
  verified?: boolean;
}

