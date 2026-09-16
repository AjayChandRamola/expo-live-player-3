// components/VideoPlayer/engine/playbackReducer.ts
// Pure status machine. Table: docs/player/04-playback-engine-spec.md §3.
// Ignored (state, event) pairs return `prev` by reference and log once in dev.
import { DEFAULT_PLAYBACK_RATE, ERROR_MESSAGES, MAX_RETRIES, MIN_BUFFER_AHEAD_MS } from "../constants";
import { devLog } from "./devLog";
import { clamp } from "./pure/clamp";
import type { EngineEvent, PlaybackError, PlaybackSnapshot, PlaybackStatus } from "./types";

type StatusChangeEvent = Extract<EngineEvent, { type: "statusChange" }>;
type TimeUpdateEvent = Extract<EngineEvent, { type: "timeUpdate" }>;

const UNKNOWN_ERROR: PlaybackError = { code: "unknown", message: ERROR_MESSAGES.unknown, retryable: true };

const SOURCE_RESET: Partial<PlaybackSnapshot> = {
  positionMs: 0,
  durationMs: 0,
  bufferedMs: 0,
  liveOffsetMs: null,
  playbackRate: DEFAULT_PLAYBACK_RATE,
  error: null,
  retryAttempt: 0,
  qualities: [],
  activeQuality: null,
  subtitleTracks: [],
  activeSubtitle: null,
  isPlayingBeforeBackground: false,
};

const CAN_END: readonly PlaybackStatus[] = ["ready", "playing", "paused", "buffering"];
const RECEIVES_TIME: readonly PlaybackStatus[] = ["loading", "ready", "playing", "paused", "buffering"];

function ignored(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot {
  devLog(`reducer.ignored.${prev.status}.${event.type}`);
  return prev;
}

/** Returns prev when every listed field is already equal (reference equality for arrays/objects). */
function withChanges(prev: PlaybackSnapshot, changes: Partial<PlaybackSnapshot>): PlaybackSnapshot {
  for (const key of Object.keys(changes) as (keyof PlaybackSnapshot)[]) {
    if (prev[key] !== changes[key]) return { ...prev, ...changes };
  }
  return prev;
}

function clampPosition(positionMs: number, durationMs: number): number {
  const rounded = Math.round(Number.isFinite(positionMs) ? positionMs : 0);
  return durationMs > 0 ? clamp(rounded, 0, durationMs) : Math.max(0, rounded);
}

function onStatusChange(prev: PlaybackSnapshot, event: StatusChangeEvent): PlaybackSnapshot {
  switch (event.status) {
    case "error":
      return { ...prev, status: "error", error: event.error ?? UNKNOWN_ERROR };
    case "loading":
      if (prev.status === "idle") return { ...prev, status: "loading" };
      if (prev.status === "playing") return { ...prev, status: "buffering" };
      if (prev.status === "error") return { ...prev, status: "loading", error: null };
      return ignored(prev, event);
    case "readyToPlay":
      if (prev.status === "loading") return { ...prev, status: "ready" };
      if (prev.status === "buffering") return prev;
      return ignored(prev, event);
    case "idle":
      return ignored(prev, event);
  }
}

function onPlayingChange(prev: PlaybackSnapshot, event: Extract<EngineEvent, { type: "playingChange" }>): PlaybackSnapshot {
  if (event.isPlaying) {
    switch (prev.status) {
      case "loading":
      case "ready":
      case "paused":
      case "buffering":
      case "ended":
        return { ...prev, status: "playing" };
      case "playing":
        return prev;
      default:
        return ignored(prev, event);
    }
  }
  switch (prev.status) {
    case "playing":
    case "buffering":
      return { ...prev, status: "paused" };
    case "paused":
      return prev;
    default:
      return ignored(prev, event);
  }
}

function onTimeUpdate(prev: PlaybackSnapshot, event: TimeUpdateEvent): PlaybackSnapshot {
  if (prev.status === "ended") {
    return withChanges(prev, { positionMs: clampPosition(event.positionMs, prev.durationMs) });
  }
  if (!RECEIVES_TIME.includes(prev.status)) return ignored(prev, event);
  const durationMs = event.durationMs > 0 ? Math.round(event.durationMs) : prev.durationMs;
  const positionMs = clampPosition(event.positionMs, durationMs);
  const bufferedMs = Math.max(0, Math.round(event.bufferedMs));
  const next = withChanges(prev, {
    positionMs,
    durationMs,
    bufferedMs,
    liveOffsetMs: prev.isLive ? event.liveOffsetMs : null,
  });
  if (next.status === "buffering" && bufferedMs > positionMs + MIN_BUFFER_AHEAD_MS) {
    return { ...next, status: "playing" };
  }
  return next;
}

function onAppBackground(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot {
  switch (prev.status) {
    case "playing":
    case "buffering":
      return { ...prev, status: "paused", isPlayingBeforeBackground: true };
    case "loading":
    case "ready":
    case "paused":
      return withChanges(prev, { isPlayingBeforeBackground: false });
    case "ended":
    case "error":
      return prev;
    case "idle":
      return ignored(prev, event);
  }
}

export function playbackReducer(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot {
  switch (event.type) {
    case "sourceSet":
      return { ...prev, ...SOURCE_RESET, status: "loading", isLive: event.isLive };
    case "disposed":
      return prev.status === "idle" && prev.error === null ? prev : { ...prev, status: "idle", error: null };
    case "statusChange":
      return onStatusChange(prev, event);
    case "sourceLoaded":
      return prev.status === "idle"
        ? ignored(prev, event)
        : withChanges(prev, {
            durationMs: event.durationMs > 0 ? Math.round(event.durationMs) : prev.durationMs,
            isLive: prev.isLive || event.isLive,
          });
    case "playingChange":
      return onPlayingChange(prev, event);
    case "timeUpdate":
      return onTimeUpdate(prev, event);
    case "playToEnd":
      return CAN_END.includes(prev.status) ? { ...prev, status: "ended" } : ignored(prev, event);
    case "stall":
      return prev.status === "playing" ? { ...prev, status: "buffering" } : ignored(prev, event);
    case "appBackground":
      return onAppBackground(prev, event);
    case "appForeground":
      return prev.status === "idle" ? ignored(prev, event) : prev;
    case "rateChange":
      return prev.status === "idle" ? ignored(prev, event) : withChanges(prev, { playbackRate: event.rate });
    case "mutedChange":
      return prev.status === "idle" ? ignored(prev, event) : withChanges(prev, { muted: event.muted });
    case "volumeChange":
      return prev.status === "idle" ? ignored(prev, event) : withChanges(prev, { volume: clamp(event.volume, 0, 1) });
    case "qualitiesChange":
      return prev.status === "idle"
        ? ignored(prev, event)
        : withChanges(prev, { qualities: event.qualities, activeQuality: event.active });
    case "subtitlesChange":
      return prev.status === "idle"
        ? ignored(prev, event)
        : withChanges(prev, { subtitleTracks: event.tracks, activeSubtitle: event.active });
    case "pipChange":
      return prev.status === "idle" ? ignored(prev, event) : withChanges(prev, { isPictureInPicture: event.active });
    case "retryScheduled":
      return prev.status !== "error"
        ? ignored(prev, event)
        : withChanges(prev, { retryAttempt: Math.min(event.attempt, MAX_RETRIES) });
  }
}
