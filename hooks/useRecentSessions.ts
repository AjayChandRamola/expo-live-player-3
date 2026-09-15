// hooks/useRecentSessions.ts
import { useCallback } from "react";
import { getRecentSessions } from "../services/liveService";
import { useLoadable } from "./useLoadable";
import type { Loadable } from "../types/result";
import type { LiveSession } from "../types/domain";

export function useRecentSessions(): Loadable<LiveSession[]> {
  const load = useCallback(() => getRecentSessions(), []);
  return useLoadable<LiveSession[]>({ load });
}
