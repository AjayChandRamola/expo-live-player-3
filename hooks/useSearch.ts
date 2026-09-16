// hooks/useSearch.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LIMITS, TIMING } from "../constants/config";
import { readRecentSearches, writeRecentSearches } from "../services/storage/settingsStorage";
import { search } from "../services/contentService";
import { useLoadable } from "./useLoadable";
import type { Loadable } from "../types/result";
import type { Video } from "../types/domain";

export interface UseSearchResult extends Loadable<Video[]> {
  readonly query: string;
  setQuery(next: string): void;
  /** Commits the current query to recent searches. Called on submit. */
  commit(): void;
  readonly recent: readonly string[];
  clearRecent(): void;
}

function sanitize(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) out += ch;
  }
  return out.trim().slice(0, LIMITS.searchQueryMaxLength);
}

export function useSearch(): UseSearchResult {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recent, setRecent] = useState<readonly string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    readRecentSearches()
      .then((queries) => {
        if (mountedRef.current) setRecent(queries);
      })
      .catch(() => {
        // Recent searches are a convenience list; a read failure just
        // starts empty rather than blocking search itself.
      });
  }, []);

  const sanitized = useMemo(() => sanitize(query), [query]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(sanitized), TIMING.searchDebounceMs);
    return () => clearTimeout(timer);
  }, [sanitized]);

  const enabled = debounced.length >= LIMITS.searchQueryMinLength;

  const load = useCallback(async (): Promise<Video[]> => {
    const page = await search(debounced, 0);
    return page.videos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const isEmpty = useCallback((list: Video[]) => list.length === 0, []);

  const loadable = useLoadable<Video[]>({ load, isEmpty, enabled });

  const commit = useCallback(() => {
    if (sanitized.length === 0) return;
    setRecent((prev) => {
      const next = [sanitized, ...prev.filter((q) => q !== sanitized)].slice(
        0,
        LIMITS.recentSearchesMax,
      );
      writeRecentSearches(next).catch(() => {
        // Losing a recent-search write should not block the current search.
      });
      return next;
    });
  }, [sanitized]);

  const clearRecent = useCallback(() => {
    setRecent([]);
    writeRecentSearches([]).catch(() => {
      // See commit(): a write failure here does not affect in-memory state.
    });
  }, []);

  return { ...loadable, query, setQuery, commit, recent, clearRecent };
}
