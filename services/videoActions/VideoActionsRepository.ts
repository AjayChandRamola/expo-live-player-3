import type { ReportReason } from "../../constants/config";

export type { ReportReason };

export interface VideoActionCounts {
  readonly likes: number;
  readonly dislikes: number;
}

export interface VideoActionState {
  readonly videoId: string;
  readonly liked: boolean;
  readonly disliked: boolean;
  readonly reported: boolean;
  readonly notInterested: boolean;
  /** null when the implementation has no counts (local). */
  readonly counts: VideoActionCounts | null;
  readonly updatedAt: string;
}

export interface ClipRecord {
  readonly id: string;
  readonly videoId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly createdAt: string;
}

export interface VideoActionsRepository {
  getState(videoId: string): Promise<VideoActionState>;
  setLike(videoId: string, liked: boolean): Promise<VideoActionState>;
  setDislike(videoId: string, disliked: boolean): Promise<VideoActionState>;
  report(videoId: string, reason: ReportReason, details?: string): Promise<VideoActionState>;
  setNotInterested(videoId: string, value: boolean): Promise<VideoActionState>;
  setChannelHidden(channelId: string, hidden: boolean): Promise<void>;
  isChannelHidden(channelId: string): Promise<boolean>;
  createClip(videoId: string, startMs: number, endMs: number): Promise<ClipRecord>;
  listClips(videoId: string): Promise<readonly ClipRecord[]>;
}
