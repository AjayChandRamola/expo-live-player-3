// hooks/useVideoDetail.ts
import { useCallback } from "react";
import { getVideoById } from "../services/contentService";
import { resolvePlayable } from "../services/mediaSourceResolver";
import { useLoadable } from "./useLoadable";
import type { Loadable } from "../types/result";
import type { PlayableSource, Video } from "../types/domain";

export interface VideoDetail {
  readonly video: Video;
  readonly source: PlayableSource;
}

export function useVideoDetail(id: string | undefined): Loadable<VideoDetail> {
  const load = useCallback(async (): Promise<VideoDetail> => {
    const video = await getVideoById(id as string);
    const source = resolvePlayable(video);
    return { video, source };
  }, [id]);

  return useLoadable<VideoDetail>({ load, enabled: Boolean(id) });
}
