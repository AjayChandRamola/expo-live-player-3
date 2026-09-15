// services/contentSourceConfig.ts
/**
 * Build-time switch between demo content and a real API.
 * Nothing outside services/ knows which is active.
 */
import Constants from "expo-constants";

export type ContentMode = "production" | "development";

export interface ContentSourceConfig {
  readonly mode: ContentMode;
  readonly apiBaseUrl: string;
  readonly allowedMediaHosts: readonly string[];
  readonly liveSourceFallback: "youtube" | "none";
}

const FALLBACK: ContentSourceConfig = {
  mode: "development",
  apiBaseUrl: "",
  allowedMediaHosts: [],
  liveSourceFallback: "none",
};

export function getContentSourceConfig(): ContentSourceConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

  const mode: ContentMode = extra.contentMode === "production" ? "production" : "development";
  const apiBaseUrl = typeof extra.apiBaseUrl === "string" ? extra.apiBaseUrl : FALLBACK.apiBaseUrl;
  const allowedMediaHosts = Array.isArray(extra.allowedMediaHosts)
    ? extra.allowedMediaHosts.filter((h): h is string => typeof h === "string")
    : [];
  const liveSourceFallback = extra.liveSourceFallback === "youtube" ? "youtube" : "none";

  return { mode, apiBaseUrl, allowedMediaHosts, liveSourceFallback };
}
