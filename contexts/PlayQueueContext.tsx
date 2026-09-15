// contexts/PlayQueueContext.tsx
/**
 * Narrowed replacement for the old VideoPlayerContext: queue position and
 * the autoplay flag only. Home scroll position is gone — that belongs to
 * the router and the list, not shared state.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Video } from "../types/domain";

export interface PlayQueueValue {
  readonly queue: readonly Video[];
  readonly currentIndex: number;
  readonly currentVideo: Video | null;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayEnabled: boolean;
  setQueue(videos: readonly Video[], startId?: string): void;
  playById(id: string): void;
  playNext(): boolean;
  playPrevious(): boolean;
  setAutoplay(enabled: boolean): void;
}

interface QueueState {
  readonly queue: readonly Video[];
  readonly currentIndex: number;
}

const PlayQueueContext = createContext<PlayQueueValue | undefined>(undefined);

export interface PlayQueueProviderProps {
  readonly children: React.ReactNode;
  /** Seeded from persisted settings once SettingsContext exists (Increment 6). */
  readonly initialAutoplay?: boolean;
}

export function PlayQueueProvider({ children, initialAutoplay = true }: PlayQueueProviderProps) {
  const [state, setState] = useState<QueueState>({ queue: [], currentIndex: -1 });
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(initialAutoplay);

  const setQueue = useCallback((videos: readonly Video[], startId?: string) => {
    const index = startId ? videos.findIndex((v) => v.id === startId) : 0;
    setState({ queue: videos, currentIndex: index >= 0 ? index : 0 });
  }, []);

  const playById = useCallback((id: string) => {
    setState((prev) => {
      const index = prev.queue.findIndex((v) => v.id === id);
      if (index === -1) return prev;
      return { ...prev, currentIndex: index };
    });
  }, []);

  const playNext = useCallback((): boolean => {
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.queue.length) return false;
    setState({ ...state, currentIndex: nextIndex });
    return true;
  }, [state]);

  const playPrevious = useCallback((): boolean => {
    const prevIndex = state.currentIndex - 1;
    if (prevIndex < 0) return false;
    setState({ ...state, currentIndex: prevIndex });
    return true;
  }, [state]);

  const setAutoplay = useCallback((enabled: boolean) => setIsAutoplayEnabled(enabled), []);

  const currentVideo = state.currentIndex >= 0 ? state.queue[state.currentIndex] ?? null : null;
  const hasNext = state.currentIndex >= 0 && state.currentIndex < state.queue.length - 1;
  const hasPrevious = state.currentIndex > 0;

  const value = useMemo<PlayQueueValue>(
    () => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      currentVideo,
      hasNext,
      hasPrevious,
      isAutoplayEnabled,
      setQueue,
      playById,
      playNext,
      playPrevious,
      setAutoplay,
    }),
    [
      state.queue,
      state.currentIndex,
      currentVideo,
      hasNext,
      hasPrevious,
      isAutoplayEnabled,
      setQueue,
      playById,
      playNext,
      playPrevious,
      setAutoplay,
    ],
  );

  return <PlayQueueContext.Provider value={value}>{children}</PlayQueueContext.Provider>;
}

export function usePlayQueue(): PlayQueueValue {
  const context = useContext(PlayQueueContext);
  if (!context) {
    throw new Error("usePlayQueue must be used within PlayQueueProvider");
  }
  return context;
}
