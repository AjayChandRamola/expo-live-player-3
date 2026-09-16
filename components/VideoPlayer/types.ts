// components/VideoPlayer/types.ts
// Public types of the player.
import type { CaptionItem, ChapterItem } from "../../types/domain";
import type { PlaybackSnapshot } from "./engine/types";

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

export interface VideoPlayerProps {
  readonly source: VideoPlayerSource;
  readonly title: string;
  readonly captions?: readonly CaptionItem[];
  readonly chapters?: readonly ChapterItem[];
  readonly autoplay?: boolean;
  readonly initialPositionMs?: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayNextEnabled: boolean;
  readonly isMinimized: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  /** Fires once when the end-screen countdown completes (autoplay-next on and hasNext). */
  readonly onFinished: () => void;
  readonly onToggleMinimize: () => void;
  readonly onToggleAutoplayNext: (enabled: boolean) => void;
  readonly onFullscreenChange: (isFullscreen: boolean) => void;
  /** Every POSITION_REPORT_INTERVAL_MS while playing, and on pause/seek/end/unmount. Not for live. */
  readonly onPositionChange: (positionMs: number, durationMs: number) => void;
  readonly onStateChange: (snapshot: PlaybackSnapshot) => void;
  readonly testID?: string;
}
