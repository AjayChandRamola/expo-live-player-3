// __tests__/player/engine/PlaybackEngine.test.ts
// Rules E1-E13: docs/player/04-playback-engine-spec.md §4
import { PlaybackEngine } from "../../../components/VideoPlayer/engine/PlaybackEngine";
import { resetDevLogDedupe } from "../../../components/VideoPlayer/engine/devLog";
import type { EngineOptions, PlaybackSnapshot } from "../../../components/VideoPlayer/engine/types";
import type { VideoPlayerSource } from "../../../components/VideoPlayer/types";
import {
  LOAD_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  STALL_TIMEOUT_MS,
  TIME_UPDATE_INTERVAL_MS,
} from "../../../components/VideoPlayer/constants";
import { createFakeVideoPlayer, type FakeVideoPlayer } from "../fakes/fakeVideoPlayer";

const MP4: VideoPlayerSource = { url: "https://example.test/v.mp4?token=secret", kind: "mp4", isLive: false };
const HLS: VideoPlayerSource = { url: "https://example.test/s.m3u8", kind: "hls", isLive: false, headers: { Authorization: "Bearer abc" } };
const LIVE: VideoPlayerSource = { url: "https://example.test/live.m3u8", kind: "hls", isLive: true };

const OPTIONS: EngineOptions = { autoplay: true, loop: false, mutedByDefault: false, timeUpdateIntervalMs: TIME_UPDATE_INTERVAL_MS };

const SUBSCRIBED_EVENTS = [
  "statusChange", "playingChange", "timeUpdate", "playToEnd", "sourceChange", "sourceLoad",
  "playbackRateChange", "mutedChange", "volumeChange", "videoTrackChange",
  "availableSubtitleTracksChange", "subtitleTrackChange",
] as const;

function setup(options: Partial<EngineOptions> = {}, fakeOverrides: Partial<FakeVideoPlayer> = {}) {
  const fake = createFakeVideoPlayer(fakeOverrides);
  const snapshots: PlaybackSnapshot[] = [];
  const engine = new PlaybackEngine(fake.asPlayer(), { ...OPTIONS, ...options }, (s) => snapshots.push(s));
  return { fake, engine, snapshots, last: () => snapshots[snapshots.length - 1] ?? engine.getSnapshot() };
}

/** Drive the fake to readyToPlay and emit one timeUpdate. */
function becomeReady(fake: FakeVideoPlayer, duration = 100) {
  fake.duration = duration;
  fake.status = "readyToPlay";
  fake.emit("sourceLoad", { videoSource: null, duration, availableVideoTracks: [], availableSubtitleTracks: [], availableAudioTracks: [] });
  fake.emit("statusChange", { status: "readyToPlay", oldStatus: "loading" });
}

function tick(fake: FakeVideoPlayer, currentTime: number, bufferedPosition = currentTime + 5) {
  fake.currentTime = currentTime;
  fake.bufferedPosition = bufferedPosition;
  fake.emit("timeUpdate", { currentTime, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition });
}

beforeEach(() => {
  jest.useFakeTimers();
  resetDevLogDedupe();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("PlaybackEngine E1/E2: construction and dispose", () => {
  it("subscribes to every engine event once and applies setup properties", () => {
    const { fake } = setup();
    for (const event of SUBSCRIBED_EVENTS) expect(fake.listenerCount(event)).toBe(1);
    expect(fake.timeUpdateEventInterval).toBe(TIME_UPDATE_INTERVAL_MS / 1000);
    expect(fake.loop).toBe(false);
    expect(fake.muted).toBe(false);
    expect(fake.keepScreenOnWhilePlaying).toBe(true);
    expect(fake.staysActiveInBackground).toBe(false);
    expect(fake.showNowPlayingNotification).toBe(false);
    expect(fake.preservesPitch).toBe(true);
  });

  it("honours loop and mutedByDefault options", () => {
    const { fake } = setup({ loop: true, mutedByDefault: true });
    expect(fake.loop).toBe(true);
    expect(fake.muted).toBe(true);
  });

  it("dispose pauses, removes every listener, clears timers and goes idle", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    expect(jest.getTimerCount()).toBeGreaterThan(0); // load timer
    engine.dispose();
    for (const event of SUBSCRIBED_EVENTS) expect(fake.listenerCount(event)).toBe(0);
    expect(fake.pause).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(last().status).toBe("idle");
  });

  it("events after dispose do not publish snapshots", () => {
    const { fake, engine, snapshots } = setup();
    engine.dispose();
    const count = snapshots.length;
    fake.emit("playToEnd", undefined);
    expect(snapshots.length).toBe(count);
  });
});

describe("PlaybackEngine E3: setSource and first ready", () => {
  it("dispatches loading, resets rate, replaces with contentType by kind and never logs headers", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fake, engine, last } = setup();
    fake.playbackRate = 1.5;
    engine.setSource(HLS);
    expect(last().status).toBe("loading");
    expect(fake.playbackRate).toBe(1);
    expect(fake.replaceCalls[0]).toEqual({ uri: HLS.url, headers: { Authorization: "Bearer abc" }, contentType: "hls" });
    engine.setSource(MP4);
    expect(fake.replaceCalls[1]).toEqual({ uri: MP4.url, headers: undefined, contentType: "auto" });
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain("Bearer");
    expect(logged).not.toContain("token=secret");
    warn.mockRestore();
  });

  it("autoplay: plays after the first readyToPlay and reaches playing", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    expect(fake.play).toHaveBeenCalledTimes(1);
    expect(last().status).toBe("playing");
    expect(last().durationMs).toBe(100_000);
  });

  it("autoplay false: stays ready", () => {
    const { fake, engine, last } = setup({ autoplay: false });
    engine.setSource(MP4);
    becomeReady(fake);
    expect(fake.play).not.toHaveBeenCalled();
    expect(last().status).toBe("ready");
  });

  it("applies initialPositionMs once, only for the first source, not near the end, not for live", () => {
    const { fake, engine } = setup({ initialPositionMs: 42_000 });
    engine.setSource(MP4);
    becomeReady(fake, 100);
    expect(fake.currentTime).toBe(42);
    engine.setSource(HLS);
    fake.currentTime = 0;
    becomeReady(fake, 100);
    expect(fake.currentTime).toBe(0);

    const nearEnd = setup({ initialPositionMs: 99_500 });
    nearEnd.engine.setSource(MP4);
    becomeReady(nearEnd.fake, 100);
    expect(nearEnd.fake.currentTime).toBe(0);

    const live = setup({ initialPositionMs: 10_000 });
    live.engine.setSource(LIVE);
    live.fake.isLive = true;
    becomeReady(live.fake, 0);
    expect(live.fake.currentTime).toBe(0);
  });

  it("explicit startMs on setSource seeks after ready", () => {
    const { fake, engine } = setup();
    engine.setSource(MP4, 30_000);
    becomeReady(fake, 100);
    expect(fake.currentTime).toBe(30);
  });

  it("marks isLive from the source or from the native flag", () => {
    const a = setup();
    a.engine.setSource(LIVE);
    expect(a.last().isLive).toBe(true);
    const b = setup();
    b.engine.setSource(HLS);
    b.fake.isLive = true;
    becomeReady(b.fake, 0);
    expect(b.last().isLive).toBe(true);
  });

  it("E10: identical events do not publish a new snapshot", () => {
    const { fake, engine, snapshots } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 1);
    const count = snapshots.length;
    tick(fake, 1, 6);
    expect(snapshots.length).toBe(count);
  });

  it("E12: tracks lastKnownPositionMs from timeUpdate", () => {
    const { fake, engine } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 12.345);
    expect(engine.lastKnownPositionMs).toBe(12_345);
  });
});

describe("PlaybackEngine E4: stall detection", () => {
  it("enters buffering after STALL_TIMEOUT_MS without timeUpdate, recovers on progress", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 1);
    jest.advanceTimersByTime(STALL_TIMEOUT_MS - 1);
    expect(last().status).toBe("playing");
    jest.advanceTimersByTime(1);
    expect(last().status).toBe("buffering");
    tick(fake, 1.1, 5); // buffered ahead > MIN_BUFFER_AHEAD_MS
    expect(last().status).toBe("playing");
  });

  it("clears the stall timer when paused", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 1);
    fake.pause();
    expect(last().status).toBe("paused");
    jest.advanceTimersByTime(STALL_TIMEOUT_MS * 2);
    expect(last().status).toBe("paused");
  });

  it("treats playing=false while native status is loading as buffering (ExoPlayer rebuffer)", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    fake.status = "loading";
    fake.playing = false;
    fake.emit("playingChange", { isPlaying: false, oldIsPlaying: true });
    expect(last().status).toBe("buffering");
  });
});

describe("PlaybackEngine E6/E11: errors and retry", () => {
  const nativeNetworkError = (fake: FakeVideoPlayer) => {
    fake.status = "error";
    fake.emit("statusChange", { status: "error", oldStatus: "readyToPlay", error: { message: "Network timed out" } });
  };

  it("schedules retries at 1s, 2s, 4s then stops in error with retryAttempt 3", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 20);

    nativeNetworkError(fake);
    expect(last().status).toBe("error");
    expect(last().error?.code).toBe("network");
    expect(last().retryAttempt).toBe(1);
    expect(fake.replaceCalls).toHaveLength(1);

    jest.advanceTimersByTime(RETRY_DELAYS_MS[0]);
    expect(fake.replaceCalls).toHaveLength(2);
    expect(last().status).toBe("loading");
    nativeNetworkError(fake);
    expect(last().retryAttempt).toBe(2);

    jest.advanceTimersByTime(RETRY_DELAYS_MS[1]);
    expect(fake.replaceCalls).toHaveLength(3);
    nativeNetworkError(fake);
    expect(last().retryAttempt).toBe(3);

    jest.advanceTimersByTime(RETRY_DELAYS_MS[2]);
    expect(fake.replaceCalls).toHaveLength(4);
    nativeNetworkError(fake);
    expect(last().retryAttempt).toBe(3);
    jest.advanceTimersByTime(60_000);
    expect(fake.replaceCalls).toHaveLength(4);
    expect(last().status).toBe("error");
  });

  it("retry resumes at the last known position and playing state", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 20);
    nativeNetworkError(fake);
    jest.advanceTimersByTime(RETRY_DELAYS_MS[0]);
    fake.currentTime = 0;
    becomeReady(fake);
    expect(fake.currentTime).toBe(20);
    expect(last().status).toBe("playing");
  });

  it("does not retry unsupported errors", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    fake.emit("statusChange", { status: "error", error: { message: "Unsupported codec" } });
    expect(last().error?.retryable).toBe(false);
    expect(last().retryAttempt).toBe(0);
    jest.advanceTimersByTime(60_000);
    expect(fake.replaceCalls).toHaveLength(1);
  });

  it("setSource during a pending retry cancels it", () => {
    // The fake never becomes ready for HLS on its own; without becomeReady()
    // the new source's own load timer would fire at LOAD_TIMEOUT_MS and start
    // an unrelated retry cascade, masking the assertion this test makes.
    const { fake, engine } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    nativeNetworkError(fake);
    engine.setSource(HLS);
    becomeReady(fake);
    jest.advanceTimersByTime(60_000);
    expect(fake.replaceCalls).toHaveLength(2); // MP4 once, HLS once, no retry replace
  });

  it("manual retry after exhaustion resets the attempt counter and plays", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 10);
    for (let i = 0; i < 4; i += 1) {
      nativeNetworkError(fake);
      jest.advanceTimersByTime(RETRY_DELAYS_MS[Math.min(i, 2)]);
    }
    expect(last().retryAttempt).toBe(3);
    engine.commands.retry();
    expect(last().status).toBe("loading");
    expect(last().retryAttempt).toBe(0);
    fake.currentTime = 0;
    becomeReady(fake);
    expect(fake.currentTime).toBe(10);
    expect(last().status).toBe("playing");
  });

  it("E11: load timeout produces a retryable network error", () => {
    const { engine, last } = setup();
    engine.setSource(MP4);
    jest.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(last().status).toBe("error");
    expect(last().error?.code).toBe("network");
    expect(last().error?.cause).toBe("load timeout");
    expect(last().retryAttempt).toBe(1);
  });

  it("readyToPlay before the timeout cancels it", () => {
    // Advancing time without simulated timeUpdate ticks would trigger the
    // independent stall timer (STALL_TIMEOUT_MS), not the load timer this
    // test targets. Tick periodically so only the load timer's absence is
    // under test.
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    const totalMs = LOAD_TIMEOUT_MS * 2;
    const stepMs = STALL_TIMEOUT_MS - 500;
    for (let elapsedMs = 0; elapsedMs < totalMs; elapsedMs += stepMs) {
      tick(fake, elapsedMs / 1000);
      jest.advanceTimersByTime(stepMs);
    }
    expect(last().status).toBe("playing");
  });

  it("retry command is a no-op outside error", () => {
    const { fake, engine } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    engine.commands.retry();
    expect(fake.replaceCalls).toHaveLength(1);
  });
});
