// components/VideoPlayer/engine/types.ts
// Shared types for the playback engine, UI and composition root.
// Spec: docs/superpowers/specs/2026-09-16-video-player-redesign-design.md §4.1

export type PlaybackStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error";

export type PlaybackErrorCode = "network" | "unsupported" | "expired" | "decode" | "unknown";

export interface PlaybackError {
  readonly code: PlaybackErrorCode;
  /** User-safe, from ERROR_MESSAGES. Never contains a URL. */
  readonly message: string;
  readonly retryable: boolean;
  /** Raw native message with query strings stripped. Logged only. */
  readonly cause?: string;
}

export interface QualityTrack {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly bitrate: number | null;
  /** "720p", or "Auto" when height is unknown. */
  readonly label: string;
}

export interface SubtitleTrackInfo {
  readonly id: string;
  readonly language: string;
  readonly label: string;
}

export interface PlaybackSnapshot {
  readonly status: PlaybackStatus;
  readonly positionMs: number;
  readonly durationMs: number;
  readonly bufferedMs: number;
  readonly isLive: boolean;
  readonly liveOffsetMs: number | null;
  readonly playbackRate: number;
  readonly muted: boolean;
  readonly volume: number;
  readonly error: PlaybackError | null;
  readonly retryAttempt: number;
  readonly qualities: readonly QualityTrack[];
  readonly activeQuality: QualityTrack | null;
  readonly subtitleTracks: readonly SubtitleTrackInfo[];
  readonly activeSubtitle: SubtitleTrackInfo | null;
  readonly isPictureInPicture: boolean;
  readonly isPlayingBeforeBackground: boolean;
}

export type NativeStatus = "idle" | "loading" | "readyToPlay" | "error";

export type EngineEvent =
  | { readonly type: "sourceSet"; readonly isLive: boolean }
  | { readonly type: "sourceLoaded"; readonly durationMs: number; readonly isLive: boolean }
  | { readonly type: "statusChange"; readonly status: NativeStatus; readonly error?: PlaybackError }
  | { readonly type: "playingChange"; readonly isPlaying: boolean }
  | {
      readonly type: "timeUpdate";
      readonly positionMs: number;
      readonly bufferedMs: number;
      readonly durationMs: number;
      readonly liveOffsetMs: number | null;
    }
  | { readonly type: "playToEnd" }
  | { readonly type: "rateChange"; readonly rate: number }
  | { readonly type: "mutedChange"; readonly muted: boolean }
  | { readonly type: "volumeChange"; readonly volume: number }
  | {
      readonly type: "qualitiesChange";
      readonly qualities: readonly QualityTrack[];
      readonly active: QualityTrack | null;
    }
  | {
      readonly type: "subtitlesChange";
      readonly tracks: readonly SubtitleTrackInfo[];
      readonly active: SubtitleTrackInfo | null;
    }
  | { readonly type: "pipChange"; readonly active: boolean }
  | { readonly type: "stall" }
  | { readonly type: "retryScheduled"; readonly attempt: number }
  | { readonly type: "appBackground" }
  | { readonly type: "appForeground" }
  | { readonly type: "disposed" };

export interface PlaybackCommands {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekTo(positionMs: number): void;
  seekBy(deltaMs: number): void;
  setRate(rate: number): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  /** Not supported by expo-video 3.0.11 (read-only videoTrack). No-op that logs in dev. */
  selectQuality(track: QualityTrack | null): void;
  selectSubtitle(track: SubtitleTrackInfo | null): void;
  goToLive(): void;
  retry(): void;
  replay(): void;
}

export interface EngineOptions {
  readonly autoplay: boolean;
  readonly loop: boolean;
  readonly mutedByDefault: boolean;
  readonly initialPositionMs?: number;
  readonly timeUpdateIntervalMs: number;
}
