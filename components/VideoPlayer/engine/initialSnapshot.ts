// components/VideoPlayer/engine/initialSnapshot.ts
import { DEFAULT_PLAYBACK_RATE } from "../constants";
import type { PlaybackSnapshot } from "./types";

const INITIAL: PlaybackSnapshot = {
  status: "idle",
  positionMs: 0,
  durationMs: 0,
  bufferedMs: 0,
  isLive: false,
  liveOffsetMs: null,
  playbackRate: DEFAULT_PLAYBACK_RATE,
  muted: false,
  volume: 1,
  error: null,
  retryAttempt: 0,
  qualities: [],
  activeQuality: null,
  subtitleTracks: [],
  activeSubtitle: null,
  isPictureInPicture: false,
  isPlayingBeforeBackground: false,
};

export function createInitialSnapshot(overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot {
  return { ...INITIAL, ...overrides };
}
