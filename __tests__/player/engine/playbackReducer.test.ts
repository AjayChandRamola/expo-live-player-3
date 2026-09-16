// __tests__/player/engine/playbackReducer.test.ts
// Normative transition table: docs/player/04-playback-engine-spec.md §3.
import { playbackReducer } from "../../../components/VideoPlayer/engine/playbackReducer";
import { createInitialSnapshot } from "../../../components/VideoPlayer/engine/initialSnapshot";
import { resetDevLogDedupe } from "../../../components/VideoPlayer/engine/devLog";
import type {
  EngineEvent,
  PlaybackError,
  PlaybackSnapshot,
  PlaybackStatus,
} from "../../../components/VideoPlayer/engine/types";

const ALL_STATUSES: readonly PlaybackStatus[] = ["idle", "loading", "ready", "playing", "paused", "buffering", "ended", "error"];
const NET_ERROR: PlaybackError = { code: "network", message: "net", retryable: true };

function at(status: PlaybackStatus, overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot {
  const base: Partial<PlaybackSnapshot> = status === "error" ? { error: NET_ERROR } : {};
  return createInitialSnapshot({ status, ...base, ...overrides });
}

const sourceSet: EngineEvent = { type: "sourceSet", isLive: false };
const loading: EngineEvent = { type: "statusChange", status: "loading" };
const ready: EngineEvent = { type: "statusChange", status: "readyToPlay" };
const nativeError: EngineEvent = { type: "statusChange", status: "error", error: NET_ERROR };
const playing: EngineEvent = { type: "playingChange", isPlaying: true };
const notPlaying: EngineEvent = { type: "playingChange", isPlaying: false };
const disposed: EngineEvent = { type: "disposed" };

/** [from, event, expected status, "ignored" when the reducer must return prev by reference] */
type Row = readonly [PlaybackStatus, EngineEvent, PlaybackStatus | "ignored", string];

const PART_A: readonly Row[] = [
  // sourceSet
  ["idle", sourceSet, "loading", "idle + sourceSet"],
  ["loading", sourceSet, "loading", "loading + sourceSet"],
  ["ready", sourceSet, "loading", "ready + sourceSet"],
  ["playing", sourceSet, "loading", "playing + sourceSet"],
  ["paused", sourceSet, "loading", "paused + sourceSet"],
  ["buffering", sourceSet, "loading", "buffering + sourceSet"],
  ["ended", sourceSet, "loading", "ended + sourceSet"],
  ["error", sourceSet, "loading", "error + sourceSet"],
  // statusChange loading
  ["idle", loading, "loading", "idle + loading"],
  ["loading", loading, "ignored", "loading + loading"],
  ["ready", loading, "ignored", "ready + loading"],
  ["playing", loading, "buffering", "playing + loading"],
  ["paused", loading, "ignored", "paused + loading"],
  ["buffering", loading, "ignored", "buffering + loading"],
  ["ended", loading, "ignored", "ended + loading"],
  ["error", loading, "loading", "error + loading (retry)"],
  // statusChange readyToPlay
  ["idle", ready, "ignored", "idle + ready"],
  ["loading", ready, "ready", "loading + ready"],
  ["ready", ready, "ignored", "ready + ready"],
  ["playing", ready, "ignored", "playing + ready"],
  ["paused", ready, "ignored", "paused + ready"],
  ["buffering", ready, "buffering", "buffering + ready (stay)"],
  ["ended", ready, "ignored", "ended + ready"],
  ["error", ready, "ignored", "error + ready"],
  // statusChange error
  ...ALL_STATUSES.map((s): Row => [s, nativeError, "error", `${s} + error`]),
  // playingChange true
  ["idle", playing, "ignored", "idle + playing"],
  ["loading", playing, "playing", "loading + playing"],
  ["ready", playing, "playing", "ready + playing"],
  ["playing", playing, "playing", "playing + playing (stay)"],
  ["paused", playing, "playing", "paused + playing"],
  ["buffering", playing, "playing", "buffering + playing"],
  ["ended", playing, "playing", "ended + playing (replay)"],
  ["error", playing, "ignored", "error + playing"],
  // playingChange false
  ["idle", notPlaying, "ignored", "idle + notPlaying"],
  ["loading", notPlaying, "ignored", "loading + notPlaying"],
  ["ready", notPlaying, "ignored", "ready + notPlaying"],
  ["playing", notPlaying, "paused", "playing + notPlaying"],
  ["paused", notPlaying, "paused", "paused + notPlaying (stay)"],
  ["buffering", notPlaying, "paused", "buffering + notPlaying"],
  ["ended", notPlaying, "ignored", "ended + notPlaying"],
  ["error", notPlaying, "ignored", "error + notPlaying"],
  // disposed
  ...ALL_STATUSES.map((s): Row => [s, disposed, "idle", `${s} + disposed`]),
];

describe("playbackReducer part A: source, status, playing, disposed", () => {
  beforeEach(() => resetDevLogDedupe());

  it.each(PART_A)("%s + %o → %s (%s)", (from, event, expected) => {
    const prev = at(from);
    const next = playbackReducer(prev, event);
    if (expected === "ignored") {
      expect(next).toBe(prev);
    } else {
      expect(next.status).toBe(expected);
    }
  });

  it("sourceSet resets position, duration, buffered, error, retryAttempt, rate and sets isLive", () => {
    const prev = at("error", { positionMs: 50, durationMs: 100, bufferedMs: 60, retryAttempt: 2, playbackRate: 2, qualities: [{ id: "1", width: 1, height: 1, bitrate: null, label: "1p" }] });
    const next = playbackReducer(prev, { type: "sourceSet", isLive: true });
    expect(next).toMatchObject({ status: "loading", positionMs: 0, durationMs: 0, bufferedMs: 0, error: null, retryAttempt: 0, playbackRate: 1, isLive: true, qualities: [], activeQuality: null });
    // muted and volume survive a source change
    const muted = playbackReducer(at("paused", { muted: true, volume: 0.3 }), sourceSet);
    expect(muted.muted).toBe(true);
    expect(muted.volume).toBe(0.3);
  });

  it("entering error stores the error; leaving error via loading clears it and keeps retryAttempt", () => {
    const errored = playbackReducer(at("playing"), nativeError);
    expect(errored.error).toEqual(NET_ERROR);
    const retrying = playbackReducer({ ...errored, retryAttempt: 2 }, loading);
    expect(retrying.status).toBe("loading");
    expect(retrying.error).toBeNull();
    expect(retrying.retryAttempt).toBe(2);
  });

  it("error without payload falls back to an unknown, retryable error", () => {
    const next = playbackReducer(at("playing"), { type: "statusChange", status: "error" });
    expect(next.error?.code).toBe("unknown");
    expect(next.error?.retryable).toBe(true);
  });

  it("disposed clears the error", () => {
    expect(playbackReducer(at("error"), disposed).error).toBeNull();
  });

  it("native idle status is ignored", () => {
    const prev = at("playing");
    expect(playbackReducer(prev, { type: "statusChange", status: "idle" })).toBe(prev);
  });
});
