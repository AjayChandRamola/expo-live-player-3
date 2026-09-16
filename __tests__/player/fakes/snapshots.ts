// __tests__/player/fakes/snapshots.ts
import { createInitialSnapshot } from "../../../components/VideoPlayer/engine/initialSnapshot";
import { ERROR_MESSAGES } from "../../../components/VideoPlayer/constants";
import type { PlaybackErrorCode, PlaybackSnapshot } from "../../../components/VideoPlayer/engine/types";

type O = Partial<PlaybackSnapshot>;
const base: O = { positionMs: 10_000, durationMs: 100_000, bufferedMs: 30_000 };

export const loadingSnapshot = (o: O = {}) => createInitialSnapshot({ status: "loading", ...o });
export const readySnapshot = (o: O = {}) => createInitialSnapshot({ status: "ready", ...base, ...o });
export const playingSnapshot = (o: O = {}) => createInitialSnapshot({ status: "playing", ...base, ...o });
export const pausedSnapshot = (o: O = {}) => createInitialSnapshot({ status: "paused", ...base, ...o });
export const bufferingSnapshot = (o: O = {}) => createInitialSnapshot({ status: "buffering", ...base, ...o });
export const endedSnapshot = (o: O = {}) => createInitialSnapshot({ status: "ended", ...base, positionMs: 100_000, ...o });
export const errorSnapshot = (code: PlaybackErrorCode = "network", o: O = {}) =>
  createInitialSnapshot({
    status: "error",
    error: { code, message: ERROR_MESSAGES[code], retryable: code !== "unsupported" },
    ...o,
  });
export const liveSnapshot = (liveOffsetMs: number | null = 0, o: O = {}) =>
  createInitialSnapshot({ status: "playing", isLive: true, durationMs: 0, liveOffsetMs, ...o });
