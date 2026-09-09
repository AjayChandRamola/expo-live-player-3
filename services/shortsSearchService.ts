/**
 * services/shortsSearchService.ts
 * 
 * Backend-agnostic search service for Shorts
 * - Search shorts by query
 * - Filter by keywords
 * - Support multiple backend sources
 * - Type-safe responses
 * 
 * Production-ready with defensive programming
 * Ready for AWS, REST API, GraphQL, Supabase, Firebase integration
 */

import type { VideoMetadata } from "../types/video";
import { fetchVideoFeed } from "./videoService";
import Logger from "../utils/Logger";

/**
 * Sanitize search query to prevent injection attacks
 */
const sanitizeQuery = (query: unknown): string => {
  if (typeof query !== "string") return "";
  return query
    .replace(/[\u0000-\u001F\u007F]/g, "") // Remove control chars
    .replace(/[<>\"'`]/g, "") // Remove HTML/script chars
    .trim()
    .slice(0, 200); // Max 200 chars
};

/**
 * Search shorts by query
 * 
 * @param query - Search query string
 * @param pageSize - Number of results to return
 * @returns Promise with filtered shorts
 * 
 * Backend Integration Points:
 * - Replace with AWS Lambda + DynamoDB query
 * - Or REST API call: fetch(`/api/shorts/search?q=${query}`)
 * - Or GraphQL: query { searchShorts(query: $query) }
 * - Or Supabase: supabase.from('shorts').select().textSearch('title', query)
 * - Or Firebase: firestore.collection('shorts').where('title', 'contains', query)
 */
export async function searchShorts(
  query: string,
  pageSize: number = 20
): Promise<VideoMetadata[]> {
  try {
    const safeQuery = sanitizeQuery(query);
    
    if (!safeQuery) {
      Logger.info("[ShortsSearch] Empty query, returning no results");
      return [];
    }

    Logger.info(`[ShortsSearch] Searching for: "${safeQuery}"`);

    // Simulate network delay (remove in production)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Current: Search local mock data
    // TODO: Replace with actual backend call
    const response = await fetchVideoFeed(0, 50);
    
    if (!response || !response.videos) {
      throw new Error("Failed to fetch videos for search");
    }

    // Filter for shorts (≤60 seconds)
    const allShorts = response.videos.filter((v) => v.duration <= 60);

    // Search filter
    const lowerQuery = safeQuery.toLowerCase();
    const results = allShorts.filter((short) => {
      const titleMatch = short.title?.toLowerCase().includes(lowerQuery);
      const descMatch = short.description?.toLowerCase().includes(lowerQuery);
      const channelMatch = short.channelName?.toLowerCase().includes(lowerQuery);
      
      return titleMatch || descMatch || channelMatch;
    });

    // Limit results
    const limitedResults = results.slice(0, pageSize);

    Logger.info(`[ShortsSearch] Found ${limitedResults.length} results`);

    return limitedResults;
  } catch (error) {
    Logger.error("[ShortsSearch] Search failed:", error);
    throw new Error("Search failed. Please try again.");
  }
}

/**
 * Get trending shorts (no search query)
 * Used as default when search is empty
 */
export async function getTrendingShorts(pageSize: number = 20): Promise<VideoMetadata[]> {
  try {
    Logger.info("[ShortsSearch] Fetching trending shorts...");

    const response = await fetchVideoFeed(0, pageSize);
    
    if (!response || !response.videos) {
      throw new Error("Failed to fetch trending shorts");
    }

    // Filter for shorts
    const shorts = response.videos.filter((v) => v.duration <= 60);

    Logger.info(`[ShortsSearch] Found ${shorts.length} trending shorts`);

    return shorts;
  } catch (error) {
    Logger.error("[ShortsSearch] Failed to fetch trending:", error);
    throw new Error("Failed to load trending shorts");
  }
}

export default searchShorts;

