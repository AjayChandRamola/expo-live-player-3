// constants/config.ts
/**
 * Player actions with UI but no verified end-to-end implementation.
 * All false for MVP. Flip one to true only when it is verified on device.
 * See HLD section F.5 and M.
 */
export const PLAYER_FEATURE_FLAGS = {
  download: false,
  pictureInPicture: false,
  qualitySelection: false,
  clipEditor: false,
  thanks: false,
  report: false,
  dislike: false,
} as const;

/** Timing, in milliseconds. */
export const TIMING = {
  httpTimeoutMs: 10_000,
  searchDebounceMs: 400,
  liveStatusPollMs: 30_000,
  liveStatusBackoffMaxMs: 300_000,
  savedWriteDebounceMs: 300,
  undoSnackbarMs: 5_000,
} as const;

/** Bounds on lists, retries, and caches. */
export const LIMITS = {
  feedPageSize: 10,
  searchPageSize: 10,
  relatedCount: 10,
  savedHydrateBatch: 20,
  recentSearchesMax: 10,
  searchQueryMaxLength: 100,
  searchQueryMinLength: 2,
  titleMaxLength: 200,
  httpRetryCount: 1,
} as const;

/** AsyncStorage keys. Bump the suffix when a payload shape changes. */
export const STORAGE_KEYS = {
  saved: "yagna.saved.v1",
  settings: "yagna.settings.v1",
  recentSearches: "yagna.recentSearches.v1",
} as const;

/** Media that mediaSourceResolver will accept. */
export const MEDIA = {
  allowedProtocols: ["https:"] as const,
  allowedExtensions: [".m3u8", ".mp4"] as const,
} as const;

/** Deep linking. Scheme matches app.json "scheme". */
export const LINKS = {
  scheme: "expoliveplayer",
  videoPath: "video",
  livePath: "live",
} as const;

/** YouTube live fallback. Used only by LiveEmbedView. */
export const YOUTUBE_EMBED = {
  origin: "https://www.youtube.com",
  allowedOrigins: [
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
  ] as const,
  embedBase: "https://www.youtube-nocookie.com/embed/",
} as const;
