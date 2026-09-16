// services/contentService.ts
/**
 * Typed domain functions for video content. Branches on
 * contentSourceConfig.mode: development reads DEMO_VIDEOS, production calls
 * httpGet with a shape guard. Nothing outside this file knows which is active.
 */
import { LIMITS } from "../constants/config";
import { makeError } from "./appError";
import { getContentSourceConfig } from "./contentSourceConfig";
import { DEMO_FEATURED, DEMO_VIDEOS } from "./demoContentProvider";
import { httpGet } from "./httpClient";
import type { Video } from "../types/domain";

interface FeedPage {
  readonly videos: Video[];
  readonly hasMore: boolean;
}

// --- Production response guards -------------------------------------------

function isVideo(value: unknown): value is Video {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<Video>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.thumbnailUrl === "string" &&
    typeof v.durationSec === "number" &&
    typeof v.publishedAt === "string" &&
    typeof v.isLive === "boolean" &&
    typeof v.channel === "object" &&
    v.channel !== null &&
    typeof v.source === "object" &&
    v.source !== null
  );
}

function isVideoOrNull(value: unknown): value is Video | null {
  return value === null || isVideo(value);
}

function isFeedPage(value: unknown): value is FeedPage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<FeedPage>;
  return Array.isArray(v.videos) && v.videos.every(isVideo) && typeof v.hasMore === "boolean";
}

function isVideoArray(value: unknown): value is Video[] {
  return Array.isArray(value) && value.every(isVideo);
}

// --- Demo helpers -----------------------------------------------------------

function sanitizeQuery(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) out += ch;
  }
  return out.trim().slice(0, LIMITS.searchQueryMaxLength);
}

function pageOf(videos: Video[], page: number, pageSize: number): FeedPage {
  const start = page * pageSize;
  const slice = videos.slice(start, start + pageSize);
  return { videos: slice, hasMore: start + pageSize < videos.length };
}

// --- Public API ---------------------------------------------------------

export async function getFeatured(): Promise<Video | null> {
  const { mode } = getContentSourceConfig();
  if (mode === "development") return DEMO_FEATURED;
  return httpGet({ path: "/videos/featured", guard: isVideoOrNull });
}

export async function getLatest(page: number): Promise<FeedPage> {
  const { mode } = getContentSourceConfig();
  if (mode === "development") return pageOf(DEMO_VIDEOS, page, LIMITS.feedPageSize);
  return httpGet({ path: `/videos/latest?page=${page}`, guard: isFeedPage });
}

export async function getVideoById(id: string): Promise<Video> {
  const trimmed = id.trim();
  if (trimmed.length === 0) throw makeError("validation");

  const { mode } = getContentSourceConfig();
  if (mode === "development") {
    const found = DEMO_VIDEOS.find((v) => v.id === trimmed) ?? (DEMO_FEATURED.id === trimmed ? DEMO_FEATURED : undefined);
    if (!found) throw makeError("not_found");
    return found;
  }
  return httpGet({ path: `/videos/${encodeURIComponent(trimmed)}`, guard: isVideo });
}

export async function getVideosByIds(ids: readonly string[]): Promise<Video[]> {
  if (ids.length === 0) return [];

  const { mode } = getContentSourceConfig();
  if (mode === "development") {
    const byId = new Map(DEMO_VIDEOS.map((v) => [v.id, v] as const));
    return ids.map((id) => byId.get(id)).filter((v): v is Video => v !== undefined);
  }
  return httpGet({
    path: `/videos?ids=${ids.map(encodeURIComponent).join(",")}`,
    guard: isVideoArray,
  });
}

export async function getRelated(id: string): Promise<Video[]> {
  const { mode } = getContentSourceConfig();
  if (mode === "development") {
    return DEMO_VIDEOS.filter((v) => v.id !== id).slice(0, LIMITS.relatedCount);
  }
  return httpGet({ path: `/videos/${encodeURIComponent(id)}/related`, guard: isVideoArray });
}

export async function search(query: string, page: number): Promise<FeedPage> {
  const clean = sanitizeQuery(query);
  if (clean.length < LIMITS.searchQueryMinLength) throw makeError("validation");

  const { mode } = getContentSourceConfig();
  if (mode === "development") {
    const q = clean.toLowerCase();
    const hits = DEMO_VIDEOS.filter(
      (v) => v.title.toLowerCase().includes(q) || (v.description ?? "").toLowerCase().includes(q),
    );
    return pageOf(hits, page, LIMITS.searchPageSize);
  }
  return httpGet({
    path: `/search?q=${encodeURIComponent(clean)}&page=${page}`,
    guard: isFeedPage,
  });
}
