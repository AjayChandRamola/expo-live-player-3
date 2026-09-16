// components/VideoPlayer/engine/PlaybackEngine.ts
// Bridges one expo-video player to the pure reducer. Owns subscriptions,
// the stall/retry/load timers and command validation.
// Rules E1-E13: docs/player/04-playback-engine-spec.md §4
import type {
  AvailableSubtitleTracksChangeEventPayload,
  MutedChangeEventPayload,
  PlaybackRateChangeEventPayload,
  PlayingChangeEventPayload,
  SourceLoadEventPayload,
  StatusChangeEventPayload,
  SubtitleTrack,
  SubtitleTrackChangeEventPayload,
  TimeUpdateEventPayload,
  VideoPlayer,
  VideoTrack,
  VideoTrackChangeEventPayload,
  VolumeChangeEventPayload,
} from "expo-video";
import {
  ERROR_MESSAGES,
  LIVE_EDGE_SEEK_SECONDS,
  LOAD_TIMEOUT_MS,
  PLAYBACK_RATES,
  RESUME_NEAR_END_GUARD_MS,
  STALL_TIMEOUT_MS,
} from "../constants";
import type { VideoPlayerSource } from "../types";
import { classifyError } from "./classifyError";
import { devLog } from "./devLog";
import { createInitialSnapshot } from "./initialSnapshot";
import { playbackReducer } from "./playbackReducer";
import { clamp } from "./pure/clamp";
import { nextRetryDelayMs } from "./retryPolicy";
import type {
  EngineEvent,
  EngineOptions,
  PlaybackCommands,
  PlaybackError,
  PlaybackSnapshot,
  QualityTrack,
  SubtitleTrackInfo,
} from "./types";

export type EngineVideoPlayer = Pick<
  VideoPlayer,
  | "play" | "pause" | "replace" | "replay" | "seekBy" | "addListener"
  | "currentTime" | "duration" | "playing" | "muted" | "volume" | "playbackRate" | "loop"
  | "bufferedPosition" | "isLive" | "currentLiveTimestamp" | "currentOffsetFromLive" | "targetOffsetFromLive"
  | "timeUpdateEventInterval" | "keepScreenOnWhilePlaying" | "staysActiveInBackground"
  | "showNowPlayingNotification" | "preservesPitch" | "subtitleTrack" | "availableSubtitleTracks"
  | "videoTrack" | "availableVideoTracks" | "status"
>;

export type AppStateName = "active" | "background" | "inactive" | "unknown" | "extension";

type Disposable = { remove(): void };
type TimerName = "stall" | "retry" | "load";

const MS_PER_SECOND = 1000;

function toMs(seconds: number | null | undefined): number {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * MS_PER_SECOND) : 0;
}

function toQuality(track: VideoTrack): QualityTrack {
  const height = track.size?.height ?? 0;
  return {
    id: track.id,
    width: track.size?.width ?? 0,
    height,
    bitrate: track.bitrate ?? null,
    label: height > 0 ? `${height}p` : "Auto",
  };
}

function toSubtitle(track: SubtitleTrack): SubtitleTrackInfo {
  return { id: track.id, language: track.language, label: track.label };
}

export class PlaybackEngine {
  readonly commands: PlaybackCommands;

  private snapshot: PlaybackSnapshot = createInitialSnapshot();
  private readonly disposables: Disposable[] = [];
  private readonly timers: Record<TimerName, ReturnType<typeof setTimeout> | null> = { stall: null, retry: null, load: null };
  private currentSource: VideoPlayerSource | null = null;
  private pendingStartMs: number | undefined;
  private resumeAfterReady = false;
  private wasPlayingBeforeError = false;
  private lastKnownMs = 0;
  private disposed = false;

  constructor(
    private readonly player: EngineVideoPlayer,
    private readonly options: EngineOptions,
    private readonly onSnapshot: (snapshot: PlaybackSnapshot) => void,
  ) {
    this.applySetup();
    this.subscribe();
    this.commands = this.buildCommands();
  }

  get lastKnownPositionMs(): number {
    return this.lastKnownMs;
  }

  getSnapshot(): PlaybackSnapshot {
    return this.snapshot;
  }

  setSource(source: VideoPlayerSource, startMs?: number): void {
    if (this.disposed) return;
    this.clearTimer("retry");
    this.clearTimer("load");
    const isFirst = this.currentSource === null;
    this.currentSource = source;
    this.pendingStartMs = startMs ?? (isFirst ? this.options.initialPositionMs : undefined);
    this.resumeAfterReady = this.options.autoplay;
    this.lastKnownMs = 0;
    this.dispatch({ type: "sourceSet", isLive: source.isLive });
    this.safeCall(() => {
      this.player.playbackRate = 1;
    }, "resetRate");
    this.safeCall(
      () =>
        this.player.replace({
          uri: source.url,
          headers: source.headers ? { ...source.headers } : undefined,
          contentType: source.kind === "hls" ? "hls" : "auto",
        }),
      "replace",
    );
    this.startTimer("load", LOAD_TIMEOUT_MS, () => this.onLoadTimeout());
  }

  notifyAppState(state: AppStateName): void {
    if (this.disposed) return;
    if (state === "background" || state === "inactive") {
      // Dispatch appBackground first, while status still reflects the real
      // pre-pause state: pause() below can emit a synchronous playingChange
      // (the fake always does; some native bridges can too), which would
      // otherwise move status to "paused" before the reducer records
      // isPlayingBeforeBackground, losing it.
      const s = this.snapshot.status;
      const wasPlaying = s === "playing" || s === "buffering";
      this.dispatch({ type: "appBackground" });
      if (wasPlaying) this.safeCall(() => this.player.pause(), "pauseOnBackground");
      return;
    }
    if (state === "active") this.dispatch({ type: "appForeground" });
  }

  notifyPictureInPicture(active: boolean): void {
    this.dispatch({ type: "pipChange", active });
  }

  dispose(): void {
    if (this.disposed) return;
    this.safeCall(() => this.player.pause(), "pauseOnDispose");
    for (const d of this.disposables.splice(0)) d.remove();
    this.clearTimer("stall");
    this.clearTimer("retry");
    this.clearTimer("load");
    this.dispatch({ type: "disposed" });
    this.disposed = true;
  }

  // ---- setup and subscriptions (E1, E2) ----

  private applySetup(): void {
    this.safeCall(() => {
      this.player.timeUpdateEventInterval = this.options.timeUpdateIntervalMs / MS_PER_SECOND;
      this.player.loop = this.options.loop;
      this.player.muted = this.options.mutedByDefault;
      this.player.keepScreenOnWhilePlaying = true;
      this.player.staysActiveInBackground = false;
      this.player.showNowPlayingNotification = false;
      this.player.preservesPitch = true;
    }, "setup");
  }

  private subscribe(): void {
    const p = this.player;
    this.disposables.push(
      p.addListener("statusChange", this.handleStatusChange),
      p.addListener("playingChange", this.handlePlayingChange),
      p.addListener("timeUpdate", this.handleTimeUpdate),
      p.addListener("playToEnd", this.handlePlayToEnd),
      p.addListener("sourceChange", this.handleSourceChange),
      p.addListener("sourceLoad", this.handleSourceLoad),
      p.addListener("playbackRateChange", this.handleRateChange),
      p.addListener("mutedChange", this.handleMutedChange),
      p.addListener("volumeChange", this.handleVolumeChange),
      p.addListener("videoTrackChange", this.handleVideoTrackChange),
      p.addListener("availableSubtitleTracksChange", this.handleSubtitleTracksChange),
      p.addListener("subtitleTrackChange", this.handleSubtitleTrackChange),
    );
  }

  // ---- event handlers ----

  private readonly handleStatusChange = (payload: StatusChangeEventPayload): void => {
    switch (payload.status) {
      case "readyToPlay": {
        this.clearTimer("load");
        const wasLoading = this.snapshot.status === "loading";
        this.dispatch({ type: "statusChange", status: "readyToPlay" });
        if (wasLoading) this.onFirstReady();
        return;
      }
      case "error":
        this.onNativeError(classifyError(payload.error?.message));
        return;
      case "loading":
        this.dispatch({ type: "statusChange", status: "loading" });
        return;
      case "idle":
        return;
    }
  };

  private readonly handlePlayingChange = (payload: PlayingChangeEventPayload): void => {
    // ExoPlayer reports playing=false at the start of a rebuffer; surface it as buffering.
    if (!payload.isPlaying && this.snapshot.status === "playing" && this.player.status === "loading") {
      this.dispatch({ type: "statusChange", status: "loading" });
      return;
    }
    this.dispatch({ type: "playingChange", isPlaying: payload.isPlaying });
  };

  private readonly handleTimeUpdate = (payload: TimeUpdateEventPayload): void => {
    this.lastKnownMs = toMs(payload.currentTime);
    this.dispatch({
      type: "timeUpdate",
      positionMs: this.lastKnownMs,
      bufferedMs: payload.bufferedPosition >= 0 ? toMs(payload.bufferedPosition) : 0,
      durationMs: toMs(this.player.duration),
      liveOffsetMs: payload.currentOffsetFromLive === null ? null : toMs(payload.currentOffsetFromLive),
    });
    if (this.snapshot.status === "playing") this.startTimer("stall", STALL_TIMEOUT_MS, () => this.onStall());
  };

  private readonly handlePlayToEnd = (): void => {
    this.dispatch({ type: "playToEnd" });
  };

  private readonly handleSourceChange = (): void => {
    // Informational only; sourceSet already moved the reducer.
  };

  private readonly handleSourceLoad = (payload: SourceLoadEventPayload): void => {
    this.dispatch({ type: "sourceLoaded", durationMs: toMs(payload.duration), isLive: this.snapshot.isLive || this.player.isLive });
  };

  private readonly handleRateChange = (payload: PlaybackRateChangeEventPayload): void => {
    this.dispatch({ type: "rateChange", rate: payload.playbackRate });
  };

  private readonly handleMutedChange = (payload: MutedChangeEventPayload): void => {
    this.dispatch({ type: "mutedChange", muted: payload.muted });
  };

  private readonly handleVolumeChange = (payload: VolumeChangeEventPayload): void => {
    this.dispatch({ type: "volumeChange", volume: payload.volume });
  };

  private readonly handleVideoTrackChange = (payload: VideoTrackChangeEventPayload): void => {
    this.dispatch({
      type: "qualitiesChange",
      qualities: (this.player.availableVideoTracks ?? []).map(toQuality),
      active: payload.videoTrack ? toQuality(payload.videoTrack) : null,
    });
  };

  private readonly handleSubtitleTracksChange = (payload: AvailableSubtitleTracksChangeEventPayload): void => {
    this.dispatch({
      type: "subtitlesChange",
      tracks: payload.availableSubtitleTracks.map(toSubtitle),
      active: this.player.subtitleTrack ? toSubtitle(this.player.subtitleTrack) : null,
    });
  };

  private readonly handleSubtitleTrackChange = (payload: SubtitleTrackChangeEventPayload): void => {
    this.dispatch({
      type: "subtitlesChange",
      tracks: this.snapshot.subtitleTracks,
      active: payload.subtitleTrack ? toSubtitle(payload.subtitleTrack) : null,
    });
  };

  // ---- load, stall, error, retry (E3-E6, E11) ----

  private onFirstReady(): void {
    const durationMs = toMs(this.player.duration);
    const isLive = this.snapshot.isLive || this.player.isLive;
    if (durationMs > 0 || isLive !== this.snapshot.isLive) this.dispatch({ type: "sourceLoaded", durationMs, isLive });
    const start = this.pendingStartMs;
    this.pendingStartMs = undefined;
    if (start !== undefined && start > 0 && !isLive && durationMs > 0 && start < durationMs - RESUME_NEAR_END_GUARD_MS) {
      this.safeCall(() => {
        this.player.currentTime = start / MS_PER_SECOND;
      }, "seekStart");
      this.lastKnownMs = start;
    }
    if (this.resumeAfterReady) this.safeCall(() => this.player.play(), "autoplay");
  }

  private onLoadTimeout(): void {
    this.timers.load = null;
    if (this.snapshot.status !== "loading") return;
    this.onNativeError({ code: "network", message: ERROR_MESSAGES.network, retryable: true, cause: "load timeout" });
  }

  private onStall(): void {
    this.timers.stall = null;
    this.dispatch({ type: "stall" });
  }

  private onNativeError(error: PlaybackError): void {
    this.clearTimer("load");
    this.clearTimer("stall");
    const s = this.snapshot.status;
    this.wasPlayingBeforeError = s === "playing" || s === "buffering" || (s === "loading" && this.resumeAfterReady);
    this.dispatch({ type: "statusChange", status: "error", error });
    const delay = nextRetryDelayMs(this.snapshot.retryAttempt, error);
    if (delay === null) return;
    this.dispatch({ type: "retryScheduled", attempt: this.snapshot.retryAttempt + 1 });
    this.startTimer("retry", delay, () => this.retrySource());
  }

  private retrySource(): void {
    this.timers.retry = null;
    const source = this.currentSource;
    if (!source || this.disposed) return;
    this.pendingStartMs = this.lastKnownMs;
    this.resumeAfterReady = this.wasPlayingBeforeError;
    this.dispatch({ type: "statusChange", status: "loading" });
    this.safeCall(
      () =>
        this.player.replace({
          uri: source.url,
          headers: source.headers ? { ...source.headers } : undefined,
          contentType: source.kind === "hls" ? "hls" : "auto",
        }),
      "replaceRetry",
    );
    this.startTimer("load", LOAD_TIMEOUT_MS, () => this.onLoadTimeout());
  }

  // ---- commands (E7) ----

  private allowed(name: string): boolean {
    const s = this.snapshot.status;
    if (s === "idle" || s === "loading" || s === "error") {
      devLog(`command.noop.${name}.${s}`);
      return false;
    }
    return true;
  }

  private seekToMs(positionMs: number, name: string): void {
    if (!this.allowed(name)) return;
    const { durationMs, isLive } = this.snapshot;
    if (isLive && durationMs <= 0) {
      devLog("command.noop.seek.liveNoWindow");
      return;
    }
    const target = durationMs > 0 ? clamp(Math.round(positionMs), 0, durationMs) : Math.max(0, Math.round(positionMs));
    this.safeCall(() => {
      this.player.currentTime = target / MS_PER_SECOND;
    }, name);
    this.lastKnownMs = target;
    this.dispatch({
      type: "timeUpdate",
      positionMs: target,
      bufferedMs: this.snapshot.bufferedMs,
      durationMs: this.snapshot.durationMs,
      liveOffsetMs: this.snapshot.liveOffsetMs,
    });
  }

  private buildCommands(): PlaybackCommands {
    return {
      play: () => {
        if (this.allowed("play")) this.safeCall(() => this.player.play(), "play");
      },
      pause: () => {
        if (this.allowed("pause")) this.safeCall(() => this.player.pause(), "pause");
      },
      togglePlay: () => {
        if (!this.allowed("togglePlay")) return;
        const s = this.snapshot.status;
        if (s === "playing" || s === "buffering") this.safeCall(() => this.player.pause(), "pause");
        else if (s === "ended") this.safeCall(() => this.player.replay(), "replay");
        else this.safeCall(() => this.player.play(), "play");
      },
      seekTo: (positionMs) => this.seekToMs(positionMs, "seekTo"),
      seekBy: (deltaMs) => this.seekToMs(this.snapshot.positionMs + deltaMs, "seekBy"),
      setRate: (rate) => {
        if (!(PLAYBACK_RATES as readonly number[]).includes(rate)) {
          devLog("command.invalid.setRate", { rate });
          return;
        }
        if (this.allowed("setRate"))
          this.safeCall(() => {
            this.player.playbackRate = rate;
          }, "setRate");
      },
      setMuted: (muted) => {
        if (this.snapshot.status === "idle") return;
        this.safeCall(() => {
          this.player.muted = muted;
        }, "setMuted");
      },
      setVolume: (volume) => {
        if (this.snapshot.status === "idle") return;
        const v = clamp(volume, 0, 1);
        this.safeCall(() => {
          this.player.volume = v;
          if (v > 0 && this.player.muted) this.player.muted = false;
        }, "setVolume");
      },
      selectQuality: () => {
        devLog("command.unsupported.selectQuality");
      },
      selectSubtitle: (track) => {
        if (!this.allowed("selectSubtitle")) return;
        this.safeCall(() => {
          this.player.subtitleTrack = track ? this.player.availableSubtitleTracks.find((t) => t.id === track.id) ?? null : null;
        }, "selectSubtitle");
      },
      goToLive: () => {
        if (!this.allowed("goToLive") || !this.snapshot.isLive) return;
        this.safeCall(() => {
          this.player.targetOffsetFromLive = 0;
          const d = this.player.duration;
          if (Number.isFinite(d) && d > 0) this.player.currentTime = d;
          else this.player.seekBy(LIVE_EDGE_SEEK_SECONDS);
        }, "goToLive");
      },
      retry: () => {
        if (this.snapshot.status !== "error" || !this.currentSource) {
          devLog(`command.noop.retry.${this.snapshot.status}`);
          return;
        }
        this.clearTimer("retry");
        const source = this.currentSource;
        const resumeAt = this.lastKnownMs;
        this.setSource(source, resumeAt);
        this.resumeAfterReady = true;
      },
      replay: () => {
        if (this.allowed("replay")) this.safeCall(() => this.player.replay(), "replay");
      },
    };
  }

  // ---- internals ----

  private dispatch(event: EngineEvent): void {
    if (this.disposed) return;
    const next = playbackReducer(this.snapshot, event);
    if (next === this.snapshot) return;
    this.snapshot = next;
    this.syncStallTimer();
    this.onSnapshot(next);
  }

  private syncStallTimer(): void {
    if (this.snapshot.status === "playing") {
      if (this.timers.stall === null) this.startTimer("stall", STALL_TIMEOUT_MS, () => this.onStall());
    } else {
      this.clearTimer("stall");
    }
  }

  private startTimer(name: TimerName, delayMs: number, fn: () => void): void {
    this.clearTimer(name);
    this.timers[name] = setTimeout(fn, delayMs);
  }

  private clearTimer(name: TimerName): void {
    const t = this.timers[name];
    if (t !== null) {
      clearTimeout(t);
      this.timers[name] = null;
    }
  }

  /** E13: no native call throws into the engine; failures are dev-logged once per label. */
  private safeCall(fn: () => void, label: string): boolean {
    try {
      fn();
      return true;
    } catch (cause) {
      devLog(`native.failed.${label}`, { cause: String(cause) });
      return false;
    }
  }
}
