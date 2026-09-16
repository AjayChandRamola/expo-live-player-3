// types/domain.ts
export interface Channel {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl?: string;
}

/** What a backend claims about a media source. Untrusted until resolved. */
export interface SourceDescriptor {
  readonly kind: "hls" | "mp4" | "youtube";
  readonly url: string;
}

/** Output of mediaSourceResolver.resolvePlayable. Never "youtube". */
export interface PlayableSource {
  readonly kind: "hls" | "mp4";
  readonly url: string;
}

/** Output of mediaSourceResolver.resolveEmbed. */
export interface EmbedTarget {
  readonly embedUrl: string;
  readonly allowedOrigins: readonly string[];
}

export interface CaptionItem {
  readonly start: number;
  readonly end?: number | null;
  readonly text: string;
}

export interface ChapterItem {
  readonly title: string;
  readonly startMs: number;
}

export interface Video {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly thumbnailUrl: string;
  readonly durationSec: number;
  readonly publishedAt: string; // ISO 8601
  readonly viewCount?: number;
  readonly channel: Channel;
  readonly isLive: boolean;
  readonly source: SourceDescriptor;
  readonly captions?: readonly CaptionItem[];
  readonly chapters?: readonly ChapterItem[];
  readonly tags?: readonly string[];
}

export interface LiveSession {
  readonly id: string;
  readonly title: string;
  readonly thumbnailUrl: string;
  readonly startsAt: string; // ISO 8601
  readonly endedAt?: string;
  readonly source: SourceDescriptor;
  readonly replayVideoId?: string;
}

export type LiveState = "live" | "upcoming" | "ended" | "none";

export interface LiveStatus {
  readonly state: LiveState;
  readonly session?: LiveSession;
  readonly checkedAt: string; // ISO 8601
}
