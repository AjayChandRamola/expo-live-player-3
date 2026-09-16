// hooks/useSavedVideos.ts
import { useCallback } from "react";
import { LIMITS } from "../constants/config";
import { useSaved } from "../contexts/SavedContext";
import { getVideosByIds } from "../services/contentService";
import { useLoadable } from "./useLoadable";
import type { Loadable } from "../types/result";
import type { Video } from "../types/domain";

export interface SavedVideosResult extends Loadable<Video[]> {
  /** Saved ids the catalogue no longer knows about. */
  readonly missingIds: readonly string[];
}

async function fetchInBatches(ids: readonly string[]): Promise<Video[]> {
  const results: Video[] = [];
  for (let i = 0; i < ids.length; i += LIMITS.savedHydrateBatch) {
    const batch = ids.slice(i, i + LIMITS.savedHydrateBatch);
    const videos = await getVideosByIds(batch);
    results.push(...videos);
  }
  return results;
}

export function useSavedVideos(): SavedVideosResult {
  const { savedIds, hydrated } = useSaved();

  const load = useCallback(async (): Promise<Video[]> => {
    if (savedIds.length === 0) return [];
    return fetchInBatches(savedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIds.join(",")]);

  const isEmpty = useCallback((list: Video[]) => list.length === 0, []);

  const loadable = useLoadable<Video[]>({ load, isEmpty, enabled: hydrated });

  const foundIds = new Set((loadable.data ?? []).map((v) => v.id));
  const byId = new Map((loadable.data ?? []).map((v) => [v.id, v] as const));
  const ordered = loadable.data ? savedIds.map((id) => byId.get(id)).filter((v): v is Video => v !== undefined) : loadable.data;
  const missingIds = loadable.data ? savedIds.filter((id) => !foundIds.has(id)) : [];

  return { ...loadable, data: ordered, missingIds };
}
