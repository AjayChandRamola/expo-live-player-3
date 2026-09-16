// services/liveService.ts
/**
 * Source-agnostic live status. Branches on contentSourceConfig.mode:
 * development returns a demo HLS session, production calls httpGet with a
 * shape guard. A response failing the guard becomes a "validation" AppError
 * rather than a silent "no live session".
 */
import { getContentSourceConfig } from "./contentSourceConfig";
import { DEMO_LIVE_HLS, DEMO_RECENT_SESSIONS } from "./demoContentProvider";
import { httpGet } from "./httpClient";
import type { LiveSession, LiveState, LiveStatus } from "../types/domain";

function isSourceDescriptor(value: unknown): value is LiveSession["source"] {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<LiveSession["source"]>;
  return (
    typeof v.url === "string" &&
    (v.kind === "hls" || v.kind === "mp4" || v.kind === "youtube")
  );
}

function isLiveSession(value: unknown): value is LiveSession {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<LiveSession>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.thumbnailUrl === "string" &&
    typeof v.startsAt === "string" &&
    isSourceDescriptor(v.source)
  );
}

function isLiveState(value: unknown): value is LiveState {
  return value === "live" || value === "upcoming" || value === "ended" || value === "none";
}

function isLiveStatus(value: unknown): value is LiveStatus {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<LiveStatus>;
  if (!isLiveState(v.state) || typeof v.checkedAt !== "string") return false;
  if (v.state === "none") return v.session === undefined || isLiveSession(v.session);
  return isLiveSession(v.session);
}

function isLiveSessionArray(value: unknown): value is LiveSession[] {
  return Array.isArray(value) && value.every(isLiveSession);
}

export async function getLiveStatus(signal?: AbortSignal): Promise<LiveStatus> {
  const { mode } = getContentSourceConfig();
  if (mode === "development") {
    return {
      state: "live",
      session: DEMO_LIVE_HLS,
      checkedAt: new Date().toISOString(),
    };
  }
  return httpGet({ path: "/live/status", guard: isLiveStatus, signal });
}

export async function getRecentSessions(): Promise<LiveSession[]> {
  const { mode } = getContentSourceConfig();
  if (mode === "development") {
    return DEMO_RECENT_SESSIONS;
  }
  return httpGet({ path: "/live/recent", guard: isLiveSessionArray });
}
