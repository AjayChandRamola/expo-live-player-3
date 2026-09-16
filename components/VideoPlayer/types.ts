// components/VideoPlayer/types.ts
// Public types of the player. VideoPlayerProps is added in Increment 4.

export interface VideoPlayerSource {
  /** https:// or file:// (downloaded MP4). Already validated by the app's resolver. */
  readonly url: string;
  readonly kind: "hls" | "mp4";
  /** Declared by the app; the engine also reads the native isLive flag. */
  readonly isLive: boolean;
  readonly posterUrl?: string;
  /** Passed to the native player. Never logged. */
  readonly headers?: Readonly<Record<string, string>>;
}

export type { PlaybackSnapshot, PlaybackStatus, PlaybackError, PlaybackCommands } from "./engine/types";
