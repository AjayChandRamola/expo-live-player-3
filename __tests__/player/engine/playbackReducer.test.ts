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

const timeUpdate = (positionMs: number, bufferedMs = 0, durationMs = 0, liveOffsetMs: number | null = null): EngineEvent => ({
  type: "timeUpdate",
  positionMs,
  bufferedMs,
  durationMs,
  liveOffsetMs,
});
const playToEnd: EngineEvent = { type: "playToEnd" };
const stall: EngineEvent = { type: "stall" };
const appBackground: EngineEvent = { type: "appBackground" };
const appForeground: EngineEvent = { type: "appForeground" };

const PART_B: readonly Row[] = [
  // timeUpdate
  ["idle", timeUpdate(1), "ignored", "idle + time"],
  ["loading", timeUpdate(1), "loading", "loading + time"],
  ["ready", timeUpdate(1), "ready", "ready + time"],
  ["playing", timeUpdate(1), "playing", "playing + time"],
  ["paused", timeUpdate(1), "paused", "paused + time"],
  ["buffering", timeUpdate(1), "buffering", "buffering + time (not enough buffer)"],
  ["ended", timeUpdate(1), "ended", "ended + time"],
  ["error", timeUpdate(1), "ignored", "error + time"],
  // playToEnd
  ["idle", playToEnd, "ignored", "idle + end"],
  ["loading", playToEnd, "ignored", "loading + end"],
  ["ready", playToEnd, "ended", "ready + end"],
  ["playing", playToEnd, "ended", "playing + end"],
  ["paused", playToEnd, "ended", "paused + end"],
  ["buffering", playToEnd, "ended", "buffering + end"],
  ["ended", playToEnd, "ignored", "ended + end"],
  ["error", playToEnd, "ignored", "error + end"],
  // stall
  ...ALL_STATUSES.map((s): Row => [s, stall, s === "playing" ? "buffering" : "ignored", `${s} + stall`]),
  // appBackground
  ["idle", appBackground, "ignored", "idle + bg"],
  ["loading", appBackground, "loading", "loading + bg"],
  ["ready", appBackground, "ready", "ready + bg"],
  ["playing", appBackground, "paused", "playing + bg"],
  ["paused", appBackground, "paused", "paused + bg"],
  ["buffering", appBackground, "paused", "buffering + bg"],
  ["ended", appBackground, "ended", "ended + bg"],
  ["error", appBackground, "error", "error + bg"],
  // appForeground: never changes status; ignored only in idle
  ...ALL_STATUSES.map((s): Row => [s, appForeground, s === "idle" ? "ignored" : s, `${s} + fg`]),
];

describe("playbackReducer part B: time, end, stall, app state", () => {
  beforeEach(() => resetDevLogDedupe());

  it.each(PART_B)("%s + %o → %s (%s)", (from, event, expected) => {
    const prev = at(from);
    const next = playbackReducer(prev, event);
    if (expected === "ignored") expect(next).toBe(prev);
    else expect(next.status).toBe(expected);
  });

  it("timeUpdate updates position, buffered, duration and clamps position to duration", () => {
    const next = playbackReducer(at("playing"), timeUpdate(150_000, 160_000, 100_000));
    expect(next).toMatchObject({ positionMs: 100_000, bufferedMs: 160_000, durationMs: 100_000 });
  });

  it("timeUpdate keeps the previous duration when the event reports 0", () => {
    const next = playbackReducer(at("playing", { durationMs: 90_000 }), timeUpdate(1_000, 2_000, 0));
    expect(next.durationMs).toBe(90_000);
  });

  it("timeUpdate keeps liveOffsetMs only for live sources", () => {
    expect(playbackReducer(at("playing", { isLive: true }), timeUpdate(1, 1, 0, 12_000)).liveOffsetMs).toBe(12_000);
    expect(playbackReducer(at("playing", { isLive: false }), timeUpdate(1, 1, 0, 12_000)).liveOffsetMs).toBeNull();
  });

  it("buffering returns to playing when the buffer is ahead by more than MIN_BUFFER_AHEAD_MS", () => {
    const next = playbackReducer(at("buffering"), timeUpdate(10_000, 10_000 + 501, 100_000));
    expect(next.status).toBe("playing");
    const still = playbackReducer(at("buffering"), timeUpdate(10_000, 10_000 + 500, 100_000));
    expect(still.status).toBe("buffering");
  });

  it("ended updates position only", () => {
    const next = playbackReducer(at("ended", { durationMs: 50_000, bufferedMs: 5 }), timeUpdate(0, 999, 60_000));
    expect(next).toMatchObject({ positionMs: 0, bufferedMs: 5, durationMs: 50_000 });
  });

  it("identical timeUpdate returns prev by reference (no re-render)", () => {
    const prev = at("playing", { positionMs: 1_000, bufferedMs: 2_000, durationMs: 3_000 });
    expect(playbackReducer(prev, timeUpdate(1_000, 2_000, 3_000))).toBe(prev);
  });

  it("appBackground from playing records isPlayingBeforeBackground; from paused clears it", () => {
    expect(playbackReducer(at("playing"), appBackground).isPlayingBeforeBackground).toBe(true);
    expect(playbackReducer(at("paused", { isPlayingBeforeBackground: true }), appBackground).isPlayingBeforeBackground).toBe(false);
  });

  it("sourceLoaded sets duration and upgrades isLive but never downgrades it", () => {
    const a = playbackReducer(at("loading"), { type: "sourceLoaded", durationMs: 42_000, isLive: true });
    expect(a).toMatchObject({ durationMs: 42_000, isLive: true });
    const b = playbackReducer(at("loading", { isLive: true, durationMs: 5 }), { type: "sourceLoaded", durationMs: 0, isLive: false });
    expect(b).toMatchObject({ durationMs: 5, isLive: true });
  });
});

describe("playbackReducer field events", () => {
  beforeEach(() => resetDevLogDedupe());

  const quality = { id: "q1", width: 1280, height: 720, bitrate: 2_000_000, label: "720p" };
  const sub = { id: "s1", language: "hi", label: "Hindi" };

  it.each<[EngineEvent, Partial<PlaybackSnapshot>]>([
    [{ type: "rateChange", rate: 1.5 }, { playbackRate: 1.5 }],
    [{ type: "mutedChange", muted: true }, { muted: true }],
    [{ type: "volumeChange", volume: 0.25 }, { volume: 0.25 }],
    [{ type: "volumeChange", volume: 7 }, { volume: 1 }],
    [{ type: "qualitiesChange", qualities: [quality], active: quality }, { qualities: [quality], activeQuality: quality }],
    [{ type: "subtitlesChange", tracks: [sub], active: null }, { subtitleTracks: [sub], activeSubtitle: null }],
    [{ type: "pipChange", active: true }, { isPictureInPicture: true }],
  ])("%o updates fields and keeps status", (event, expected) => {
    for (const status of ALL_STATUSES) {
      const prev = at(status);
      const next = playbackReducer(prev, event);
      if (status === "idle") expect(next).toBe(prev);
      else {
        expect(next.status).toBe(status);
        expect(next).toMatchObject(expected);
      }
    }
  });

  it("retryScheduled only applies in error and is capped at MAX_RETRIES", () => {
    expect(playbackReducer(at("error"), { type: "retryScheduled", attempt: 2 }).retryAttempt).toBe(2);
    expect(playbackReducer(at("error"), { type: "retryScheduled", attempt: 99 }).retryAttempt).toBe(3);
    const prev = at("playing");
    expect(playbackReducer(prev, { type: "retryScheduled", attempt: 1 })).toBe(prev);
  });
});

describe("playbackReducer invariants", () => {
  const EVENTS: readonly EngineEvent[] = [
    sourceSet, loading, ready, nativeError, playing, notPlaying, disposed, playToEnd, stall, appBackground, appForeground,
    timeUpdate(5_000, 9_000, 8_000, 100), { type: "sourceLoaded", durationMs: 1, isLive: false },
    { type: "rateChange", rate: 2 }, { type: "mutedChange", muted: true }, { type: "volumeChange", volume: 2 },
    { type: "pipChange", active: true }, { type: "retryScheduled", attempt: 9 },
  ];

  it("hold after every (status, event) pair", () => {
    for (const status of ALL_STATUSES) {
      for (const event of EVENTS) {
        const next = playbackReducer(at(status, { positionMs: 7_000, durationMs: 8_000, bufferedMs: 7_500 }), event);
        expect(next.positionMs).toBeGreaterThanOrEqual(0);
        if (next.durationMs > 0) expect(next.positionMs).toBeLessThanOrEqual(next.durationMs);
        expect(next.error !== null).toBe(next.status === "error");
        expect(next.retryAttempt).toBeLessThanOrEqual(3);
        expect(next.volume).toBeGreaterThanOrEqual(0);
        expect(next.volume).toBeLessThanOrEqual(1);
      }
    }
  });
});
