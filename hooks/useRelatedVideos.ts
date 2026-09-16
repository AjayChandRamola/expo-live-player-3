// hooks/useRelatedVideos.ts
import { useCallback } from "react";
import { getRelated } from "../services/contentService";
import { useLoadable } from "./useLoadable";
import type { Loadable } from "../types/result";
import type { Video } from "../types/domain";

export function useRelatedVideos(id: string | undefined): Loadable<Video[]> {
  const load = useCallback(() => getRelated(id as string), [id]);
  const isEmpty = useCallback((list: Video[]) => list.length === 0, []);

  return useLoadable<Video[]>({ load, isEmpty, enabled: Boolean(id) });
}
