// constants/config.ts
/**
 * Player actions with UI but no verified end-to-end implementation.
 * All false for MVP. Flip one to true only when it is verified on device.
 * See HLD section F.5 and M.
 */
export const PLAYER_FEATURE_FLAGS = {
  // Stays false: F33 tests are green, but manual matrix row M23 was not run
  // (no device available in Increment 6). See docs/superpowers/plans/
  // 2026-09-16-video-player-07-report.md.
  download: false,
  // Stays false: F21 tests are green, but manual matrix row M19 was not run
  // (no device available in Increment 6).
  pictureInPicture: false,
  // Never enabled in this effort: expo-video 3.0.11's videoTrack is read-only.
  qualitySelection: false,
  // F34 tests green; metadata-only, no manual matrix dependency.
  clipEditor: true,
  // Human decision pending (ADR 0009); stays false.
  thanks: false,
  // F35 tests green; no manual matrix dependency.
  report: true,
  // F30 tests green; no manual matrix dependency.
  dislike: true,
} as const;

/** Timing, in milliseconds. */
export const TIMING = {
  httpTimeoutMs: 10_000,
  searchDebounceMs: 400,
  liveStatusPollMs: 30_000,
  liveStatusBackoffMaxMs: 300_000,
  savedWriteDebounceMs: 300,
  undoSnackbarMs: 5_000,
  downloadProgressThrottleMs: 500,
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
  maxConcurrentDownloads: 1,
  downloadMinFreeBytes: 200 * 1024 * 1024,
  clipMinMs: 1_000,
  clipMaxMs: 60_000,
  reportDetailsMaxLength: 500,
} as const;

/** AsyncStorage keys. Bump the suffix when a payload shape changes. */
export const STORAGE_KEYS = {
  saved: "yagna.saved.v1",
  settings: "yagna.settings.v1",
  recentSearches: "yagna.recentSearches.v1",
  videoActions: "yagna.videoActions.v1",
  downloads: "yagna.downloads.v1",
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

/** Preset Thanks amounts. Currency fixed to INR for MVP. */
export const THANKS_PRESETS = [
  { amountMinor: 5_100, currency: "INR", label: "₹51" },
  { amountMinor: 10_100, currency: "INR", label: "₹101" },
  { amountMinor: 50_100, currency: "INR", label: "₹501" },
  { amountMinor: 100_100, currency: "INR", label: "₹1,001" },
] as const;

/** Reasons a user can pick when reporting a video. */
export const REPORT_REASONS = ["inappropriate", "spam", "misleading", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** YouTube live fallback. Used only by LiveEmbedView. */
export const YOUTUBE_EMBED = {
  origin: "https://www.youtube.com",
  allowedOrigins: [
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
  ] as const,
  embedBase: "https://www.youtube-nocookie.com/embed/",
} as const;
