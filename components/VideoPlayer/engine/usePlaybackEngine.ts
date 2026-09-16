// components/VideoPlayer/engine/usePlaybackEngine.ts
// React binding for PlaybackEngine. Owns the expo-video player instance,
// the AppState subscription and the onPositionChange cadence (E9).
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useVideoPlayer, type VideoPlayer } from "expo-video";
import { POSITION_REPORT_INTERVAL_MS } from "../constants";
import type { VideoPlayerSource } from "../types";
import { PlaybackEngine, type AppStateName } from "./PlaybackEngine";
import type { EngineOptions, PlaybackCommands, PlaybackSnapshot } from "./types";

export interface UsePlaybackEngineCallbacks {
  readonly onPositionChange?: (positionMs: number, durationMs: number) => void;
}

export interface UsePlaybackEngineResult {
  readonly snapshot: PlaybackSnapshot;
  readonly commands: PlaybackCommands;
  readonly player: VideoPlayer;
  readonly notifyPictureInPicture: (active: boolean) => void;
}

interface EngineStore {
  readonly engine: PlaybackEngine;
  subscribe(listener: () => void): () => void;
  getSnapshot(): PlaybackSnapshot;
}

function createStore(player: VideoPlayer, options: EngineOptions): EngineStore {
  const listeners = new Set<() => void>();
  let current: PlaybackSnapshot | null = null;
  const engine = new PlaybackEngine(player, options, (snapshot) => {
    current = snapshot;
    for (const listener of listeners) listener();
  });
  current = engine.getSnapshot();
  return {
    engine,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => current ?? engine.getSnapshot(),
  };
}

export function usePlaybackEngine(
  source: VideoPlayerSource,
  options: EngineOptions,
  callbacks: UsePlaybackEngineCallbacks = {},
): UsePlaybackEngineResult {
  const player = useVideoPlayer(null);
  const storeRef = useRef<EngineStore | null>(null);
  if (storeRef.current === null) storeRef.current = createStore(player, options);
  const store = storeRef.current;
  const { engine } = store;

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const lastReportedMsRef = useRef(Number.NEGATIVE_INFINITY);
  const prevStatusRef = useRef(snapshot.status);
  const lastUrlRef = useRef<string | null>(null);

  const report = useCallback(() => {
    const s = engine.getSnapshot();
    if (s.isLive) return;
    const cb = callbacksRef.current.onPositionChange;
    if (!cb) return;
    lastReportedMsRef.current = engine.lastKnownPositionMs;
    cb(engine.lastKnownPositionMs, s.durationMs);
  }, [engine]);

  // Source changes: one replace per URL change; report the old position first.
  useEffect(() => {
    if (lastUrlRef.current === source.url) return;
    if (lastUrlRef.current !== null) report();
    lastUrlRef.current = source.url;
    lastReportedMsRef.current = Number.NEGATIVE_INFINITY;
    engine.setSource(source);
  }, [engine, report, source]);

  // AppState and disposal.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => engine.notifyAppState(state as AppStateName));
    return () => {
      subscription.remove();
      report();
      engine.dispose();
    };
  }, [engine, report]);

  // Position cadence: every POSITION_REPORT_INTERVAL_MS while playing, and on pause/ended edges.
  useEffect(() => {
    const statusChanged = prevStatusRef.current !== snapshot.status;
    prevStatusRef.current = snapshot.status;
    if (snapshot.isLive) return;
    const due = snapshot.status === "playing" && snapshot.positionMs - lastReportedMsRef.current >= POSITION_REPORT_INTERVAL_MS;
    const edge = statusChanged && (snapshot.status === "paused" || snapshot.status === "ended");
    if (due || edge) report();
  }, [snapshot, report]);

  const commands = useMemo<PlaybackCommands>(
    () => ({
      ...engine.commands,
      seekTo: (positionMs) => {
        engine.commands.seekTo(positionMs);
        report();
      },
      seekBy: (deltaMs) => {
        engine.commands.seekBy(deltaMs);
        report();
      },
    }),
    [engine, report],
  );

  const notifyPictureInPicture = useCallback((active: boolean) => engine.notifyPictureInPicture(active), [engine]);

  return { snapshot, commands, player, notifyPictureInPicture };
}
