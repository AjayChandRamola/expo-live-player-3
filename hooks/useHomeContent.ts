// hooks/useHomeContent.ts
import { useCallback, useRef, useState } from "react";
import { getFeatured, getLatest } from "../services/contentService";
import { useLoadable } from "./useLoadable";
import type { Loadable } from "../types/result";
import type { Video } from "../types/domain";

export interface HomeContent {
  readonly featured: Video | null;
  readonly latest: readonly Video[];
}

export interface UseHomeContentResult extends Loadable<HomeContent> {
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly loadMore: () => void;
}

export function useHomeContent(): UseHomeContentResult {
  const [appended, setAppended] = useState<Video[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageRef = useRef(0);
  /** Synchronous guard: state updates from setIsLoadingMore don't land until
   * the next render, so two loadMore() calls in the same tick would both
   * read isLoadingMore as false. This ref closes that gap. */
  const inFlightRef = useRef(false);

  const load = useCallback(async (): Promise<HomeContent> => {
    pageRef.current = 0;
    setAppended([]);

    const [featuredResult, latestResult] = await Promise.allSettled([getFeatured(), getLatest(0)]);

    const featured = featuredResult.status === "fulfilled" ? featuredResult.value : null;

    if (latestResult.status === "rejected") {
      throw latestResult.reason;
    }

    setHasMore(latestResult.value.hasMore);
    return { featured, latest: latestResult.value.videos };
  }, []);

  const isEmpty = useCallback(
    (d: HomeContent) => d.latest.length === 0 && d.featured === null,
    [],
  );

  const base = useLoadable<HomeContent>({ load, isEmpty });

  const loadMore = useCallback(() => {
    if (!hasMore || inFlightRef.current || base.status !== "success") return;
    inFlightRef.current = true;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    getLatest(nextPage)
      .then((result) => {
        pageRef.current = nextPage;
        setAppended((prev) => [...prev, ...result.videos]);
        setHasMore(result.hasMore);
      })
      .finally(() => {
        inFlightRef.current = false;
        setIsLoadingMore(false);
      });
  }, [hasMore, base.status]);

  const data: HomeContent | null = base.data
    ? { featured: base.data.featured, latest: [...base.data.latest, ...appended] }
    : null;

  return { ...base, data, hasMore, isLoadingMore, loadMore };
}
