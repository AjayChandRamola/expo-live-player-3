// contexts/SavedContext.tsx
/**
 * Single source of truth for saved and liked video ids. Hydrates from device
 * storage on mount and writes back through a debounced, serialized writer so
 * rapid toggles cannot interleave into corrupt writes.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { TIMING } from "../constants/config";
import Logger from "../utils/Logger";
import { readSaved, writeSaved, type SavedState } from "../services/storage/savedStorage";

export interface SavedValue {
  readonly savedIds: readonly string[];
  readonly hydrated: boolean;
  isSaved(id: string): boolean;
  isLiked(id: string): boolean;
  toggleSave(id: string): void;
  toggleLike(id: string): void;
}

const SavedContext = createContext<SavedValue | undefined>(undefined);

export interface SavedProviderProps {
  readonly children: React.ReactNode;
}

export function SavedProvider({ children }: SavedProviderProps) {
  const [state, setState] = useState<SavedState>({ savedIds: [], likedIds: [] });
  const [hydrated, setHydrated] = useState(false);

  const mountedRef = useRef(true);
  const hydratedRef = useRef(false);
  const pendingRef = useRef<SavedState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    readSaved()
      .then((result) => {
        if (!mountedRef.current) return;
        setState(result);
      })
      .catch((cause) => {
        Logger.error("[SavedContext] Failed to read saved state", cause);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        hydratedRef.current = true;
        setHydrated(true);
      });
  }, []);

  const scheduleWrite = useCallback((next: SavedState) => {
    if (!hydratedRef.current) return;
    pendingRef.current = next;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const toWrite = pendingRef.current;
      pendingRef.current = null;
      if (!toWrite) return;
      writeSaved(toWrite).catch((cause) => {
        Logger.error("[SavedContext] Failed to write saved state", cause);
      });
    }, TIMING.savedWriteDebounceMs);
  }, []);

  const toggleSave = useCallback(
    (id: string) => {
      setState((prev) => {
        const isCurrentlySaved = prev.savedIds.includes(id);
        const next: SavedState = {
          ...prev,
          savedIds: isCurrentlySaved
            ? prev.savedIds.filter((savedId) => savedId !== id)
            : [id, ...prev.savedIds.filter((savedId) => savedId !== id)],
        };
        scheduleWrite(next);
        return next;
      });
    },
    [scheduleWrite],
  );

  const toggleLike = useCallback(
    (id: string) => {
      setState((prev) => {
        const isCurrentlyLiked = prev.likedIds.includes(id);
        const next: SavedState = {
          ...prev,
          likedIds: isCurrentlyLiked
            ? prev.likedIds.filter((likedId) => likedId !== id)
            : [...prev.likedIds, id],
        };
        scheduleWrite(next);
        return next;
      });
    },
    [scheduleWrite],
  );

  const isSaved = useCallback((id: string) => state.savedIds.includes(id), [state.savedIds]);
  const isLiked = useCallback((id: string) => state.likedIds.includes(id), [state.likedIds]);

  const value = useMemo<SavedValue>(
    () => ({
      savedIds: state.savedIds,
      hydrated,
      isSaved,
      isLiked,
      toggleSave,
      toggleLike,
    }),
    [state.savedIds, hydrated, isSaved, isLiked, toggleSave, toggleLike],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedValue {
  const context = useContext(SavedContext);
  if (!context) {
    throw new Error("useSaved must be used within SavedProvider");
  }
  return context;
}
