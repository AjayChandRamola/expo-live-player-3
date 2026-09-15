# Yagna Mobile MVP — Low-Level Design (Master Index and Shared Contracts)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each increment plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read this document first, then your increment plan.** This file holds every shared type, signature, constant, and convention. Increment plans reference them by name and never redefine them.

**Goal:** Build the Yagna mobile MVP (Home, Live, Shorts, Saved, Video, Search, Settings) around the existing `components/VideoPlayer`, without rewriting it.

**Architecture:** Expo Router screens call feature hooks; hooks call services; services call data sources. A single `VideoPlaybackContainer` is the only bridge between the domain model and the existing player. Two-to-three React contexts hold cross-screen state. No new runtime dependencies.

**Tech Stack:** React Native 0.81.4, React 19.1.0, Expo SDK 54.0.22, Expo Router 6, TypeScript 5.9 (strict), expo-video 3.0.11, AsyncStorage 2.2, react-native-webview 13.15, Jest 29 + jest-expo 54 + React Native Testing Library 13.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md` — the approved HLD. This LLD argues from that spec; executors read both.

---

## 0. Increment Roadmap

Execute in this order. Each plan file produces working, verifiable software.

| # | Plan file | Produces |
|---|---|---|
| 0A | `2026-09-15-yagna-mvp-00a-test-harness.md` | A working `npm test`. Prerequisite for all TDD. |
| 0B | `2026-09-15-yagna-mvp-00b-player-stabilization.md` | Player type-clean, TDZ bug fixed, dead code gone, unverified actions flagged off. |
| 1 | `2026-09-15-yagna-mvp-01-foundations.md` | Tokens, `StateView`, `AppError`, storage, http client, content services, resolver. |
| 2 | `2026-09-15-yagna-mvp-02-navigation-home.md` | Four tabs, stack screens, Home with three sections. |
| 3 | `2026-09-15-yagna-mvp-03-video-screen.md` | `PlayQueueContext`, `VideoPlaybackContainer`, rebuilt video screen. |
| 4 | `2026-09-15-yagna-mvp-04-saved.md` | `SavedContext`, Saved tab, save sheet simplified. |
| 5 | `2026-09-15-yagna-mvp-05-live.md` | Live tab, polling lifecycle, HLS and YouTube paths. |
| 6 | `2026-09-15-yagna-mvp-06-search-settings.md` | Search screen, Settings screen, `SettingsContext`. |
| 7 | `2026-09-15-yagna-mvp-07-hardening.md` | Offline, deep links, cleanup, full verification matrix. |

---

## 1. Global Constraints

Every task inherits these. Values are copied verbatim from the HLD and from verified source inspection.

1. **Expo Managed Workflow.** No native code, no `expo prebuild` in normal work, no ejecting.
2. **Pinned versions:** Expo SDK 54.0.22, React 19.1.0, React Native 0.81.4, Expo Router ~6.0.14, TypeScript ~5.9.2, expo-video ~3.0.11.
3. **No new runtime dependencies.** Test-only devDependencies in Increment 0A are the sole exception and are named there. Any other addition requires a new ADR appended to the HLD.
4. **Strict TypeScript.** No `any`, no `@ts-ignore`, no `@ts-nocheck` in new or modified code.
5. **Protected modules.** `components/VideoPlayer/`, `components/Shorts/`, `contexts/VideoPlayerContext.tsx` change **only** in Increment 0B (player stabilization), Increment 3 (context rename), and Increment 4 (one save-sheet change). No other increment touches them.
6. **Layer rules.** Screens import hooks, contexts, feature components, and `components/ui`. Feature components import `components/ui`, `constants/tokens`, and `types`. Hooks import services. Services import data sources. No upward or sideways imports.
7. **Only `services/storage/asyncStorageAdapter.ts` imports AsyncStorage. Only `services/httpClient.ts` calls `fetch`. Only `components/Video/VideoPlaybackContainer.tsx` imports `components/VideoPlayer` (tests excepted).**
8. **No magic values.** Every interval, limit, key, and size lives in `constants/config.ts` or `constants/tokens.ts`.
9. **No placeholders in production folders.** No files named `*Demo.tsx`, `*.example.tsx`, or `*Test.tsx` outside `__tests__/`.
10. **User-facing error text comes only from `AppError.message`.** Raw exceptions go to `Logger` and are never rendered.
11. **HTTPS only.** No `http:` media or API URLs. No TLS bypass.
12. **Commit after every task.** Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`).

---

## 2. Verified Baseline (measured 2026-09-15, not assumed)

Re-run these before starting; if the numbers differ, stop and report.

```bash
npx tsc --noEmit                 # 68 errors
npx eslint . --ext .js,.jsx,.ts,.tsx   # 8 errors, 421 warnings
npm test                         # FAILS: "'jest' is not recognized" — jest is not installed
```

**Facts established by source inspection.** Increment plans depend on these exact details.

| Fact | Evidence |
|---|---|
| Playback engine is **expo-video**, not expo-av | `components/VideoPlayer/index.tsx:35` imports `{ VideoView, useVideoPlayer } from "expo-video"`. `expo-av` is absent from `package.json` and `node_modules`. |
| `components/VideoPlayer/hooks/useVideoPlayer.ts` is **dead code** | It imports `expo-av` at line 12. A repo-wide grep finds no importer except a Markdown file. |
| **TDZ bug**: `isPlaying` used at line 173, declared at line 207 | `components/VideoPlayer/index.tsx`. `tsc` reports TS2448 and TS2454 at 173:16. |
| `Props` type at lines 58-80 **omits** `videoId`, `videoTitle`, `videoUrl`, `channelId`, which are destructured at lines 112-115 | `tsc` reports TS2339 four times at lines 112-115. |
| The action bar and progress bar render **only when `videoId` is truthy** | `components/VideoPlayer/index.tsx:909` and `:946` guard on `videoId`. |
| Duplicate autoplay state | Local `autoplayEnabled` state at line 126 coexists with the `isAutoplayEnabled` prop at line 109. |
| **Nothing is persisted** | No file in `app/`, `components/`, `contexts/`, `hooks/`, `services/`, or `utils/` imports AsyncStorage. `services/videoActionsService.ts` is in-memory. |
| Existing tests are **broken** | `__tests__/Logger.test.ts` calls `LoggerFactory.getLogger()`, which `utils/Logger.ts` does not export. `Comments.test.tsx` and `Shorts.test.tsx` import the uninstalled `@testing-library/react-native`. |
| `hooks/useVoiceSearch.ts` imports uninstalled `expo-speech` | ESLint `import/no-unresolved` at line 16. |
| `components/Comments/CommentsModal.tsx:648` uses `ActivityIndicator` without importing it | ESLint `react/jsx-no-undef`. Real runtime crash risk. |
| Unknown video id silently falls back to the first demo entry | `app/video/[id].tsx` uses `?? SAFE_VIDEO_CATALOG[0]`. |
| `Logger.info(scope, ...parts)` takes **scope first** | `utils/Logger.ts`. Most existing calls pass the message as the scope; this is harmless and is not a target for cleanup. |
| Tabs today are Home, Shorts, Explore | `app/(tabs)/_layout.tsx`. Explore is the unmodified Expo template screen. |

---

## 3. Deviations From the HLD That Need Human Approval

Flag these to the reviewer before or during execution. Do not silently resolve them.

**D1 — A third context is required: `SettingsContext`.**
The HLD's ADR 2 says "two contexts only." But the theme preference is read by `app/_layout.tsx` (app-wide), written by the Settings screen, and the autoplay default is read by `PlayQueueContext`. A hook alone cannot share that state across the tree. This LLD therefore adds a third, deliberately tiny context. Proposed **ADR 11**: *Decision* — add `SettingsContext` holding `{ themePreference, autoplayDefault }`. *Reason* — app-wide read of a persisted preference. *Alternatives* — prop drilling (impossible through the router), folding settings into `SavedContext` (wrong domain), re-reading storage in every consumer (duplicate source of truth). *Consequences* — three contexts; each must stay under 120 lines. **If the reviewer rejects this, Increment 6 must be re-scoped and the theme toggle dropped from MVP.**

**D2 — The HLD's Increment 0 exit criterion "existing tests pass" is unachievable.**
Jest is not installed and all three existing test files are broken. Increment 0A is inserted to restore the harness. `Logger.test.ts` is rewritten against the real `Logger` API rather than deleted, because deleting a test to make a gate pass is forbidden by CLAUDE.md section 9.

**D3 — Increment 0B cannot fully verify the player on device from this environment.**
Type errors, lint errors, and render tests are verifiable here. Real MP4/HLS playback on Android and iOS hardware is not. Increment 0B ends with a **manual verification checklist the human must run**, and the increment is not "done" until they do.

---

## 4. Complete File Map

### 4.1 Files to create

| Path | Responsibility | Increment |
|---|---|---|
| `constants/tokens.ts` | Design tokens: colors (light/dark), typography, spacing, radius, elevation, icon sizes, motion | 1 |
| `constants/config.ts` | Intervals, limits, storage keys, player feature flags, allowlists | 1 |
| `types/domain.ts` | `Channel`, `SourceDescriptor`, `PlayableSource`, `Video`, `LiveSession`, `LiveStatus`, `EmbedTarget` | 1 |
| `types/result.ts` | `AppErrorCode`, `AppError`, `LoadStatus`, `Loadable` | 1 |
| `services/appError.ts` | `makeError`, `isAppError`, `toAppError` | 1 |
| `services/storage/asyncStorageAdapter.ts` | The only AsyncStorage importer; `readJson`, `writeJson`, `removeKey` | 1 |
| `services/storage/savedStorage.ts` | Read/write `SavedState` at key `yagna.saved.v1` | 1 |
| `services/storage/settingsStorage.ts` | Read/write `Settings` and recent searches | 1 |
| `services/contentSourceConfig.ts` | Build-time demo vs production switch | 1 |
| `services/httpClient.ts` | The only `fetch` caller; timeout, schema guard, error mapping | 1 |
| `services/demoContentProvider.ts` | Demo catalog matching API response shapes | 1 |
| `services/contentService.ts` | `getFeatured`, `getLatest`, `getVideoById`, `getVideosByIds`, `getRelated`, `search` | 1 |
| `services/mediaSourceResolver.ts` | `resolvePlayable`, `resolveEmbed` | 1 |
| `services/liveService.ts` | `getLiveStatus`, `getRecentSessions` | 5 |
| `services/shareLinkService.ts` | `forVideo`, `forLive` | 3 |
| `services/analytics.ts` | No-op sink, three events | 3 |
| `hooks/useLoadable.ts` | Shared status machine with stale-response guard and cancellation | 1 |
| `hooks/useIsOnline.ts` | Offline signal from error codes and `AppState` | 7 |
| `hooks/useHomeContent.ts` | Featured + latest | 2 |
| `hooks/useVideoDetail.ts` | Video + resolved source by id | 3 |
| `hooks/useRelatedVideos.ts` | Related list | 3 |
| `hooks/useSavedVideos.ts` | Hydrate saved ids to videos | 4 |
| `hooks/useLiveStatus.ts` | Polled live status with lifecycle guards | 5 |
| `hooks/useSearch.ts` | Debounced search | 6 |
| `services/deepLinkService.ts` | Validate and classify incoming deep links | 7 |
| `contexts/PlayQueueContext.tsx` | Queue list, index, next/previous, autoplay flag | 3 |
| `contexts/SavedContext.tsx` | Saved and liked id sets, persisted | 4 |
| `contexts/SettingsContext.tsx` | Theme preference, autoplay default (see D1) | 6 |
| `components/ui/Screen.tsx` | Safe-area wrapper | 1 |
| `components/ui/StateView.tsx` | One component for loading/empty/error/offline | 1 |
| `components/ui/Skeleton.tsx` | Placeholder blocks | 1 |
| `components/ui/PrimaryButton.tsx` | Token-driven button | 1 |
| `components/ui/IconButton.tsx` | Token-driven icon button | 1 |
| `components/ui/OfflineBanner.tsx` | Connectivity banner | 7 |
| `components/Home/SectionHeader.tsx` | Section title row | 2 |
| `components/Home/FeaturedYagnaCard.tsx` | Featured hero card | 2 |
| `components/Video/VideoPlaybackContainer.tsx` | Domain-to-player bridge | 3 |
| `components/Video/VideoMeta.tsx` | Title, channel, expandable description | 3 |
| `components/Saved/SavedList.tsx` | Saved rows | 4 |
| `components/Saved/EmptySaved.tsx` | Empty state | 4 |
| `components/Live/LiveBadge.tsx` | Red live pill | 5 |
| `components/Live/LiveNowBanner.tsx` | Home banner | 5 |
| `components/Live/LiveHero.tsx` | Live state switch | 5 |
| `components/Live/LiveEmbedView.tsx` | Constrained YouTube WebView | 5 |
| `components/Live/UpcomingCard.tsx` | Countdown card | 5 |
| `components/Live/LiveEndedOverlay.tsx` | Ended + replay | 5 |
| `components/Live/RecentSessionsList.tsx` | Replay list | 5 |
| `components/Search/SearchInput.tsx` | Debounced input | 6 |
| `components/Search/RecentSearches.tsx` | Recent query chips | 6 |
| `app/(tabs)/live.tsx` | Live tab screen | 5 |
| `app/(tabs)/saved.tsx` | Saved tab screen | 4 |
| `app/search.tsx` | Search stack screen | 6 |
| `app/settings.tsx` | Settings stack screen | 6 |

### 4.2 Files to modify

| Path | Change | Increment |
|---|---|---|
| `package.json` | Add test devDependencies; fix jest config | 0A |
| `components/VideoPlayer/index.tsx` | Add 4 props to `Props`; fix TDZ bug; remove duplicate autoplay state; gate flagged actions | 0B |
| `components/VideoPlayer/types.ts` | Align `VideoPlayerProps` with the real component | 0B |
| `components/VideoPlayer/Controls.tsx` | Fix icon prop typing | 0B |
| `components/VideoPlayer/AutoplayNotification.tsx` | Replace private `__getValue()` | 0B |
| `components/Comments/CommentsModal.tsx` | Import `ActivityIndicator` | 0B |
| `app/(tabs)/_layout.tsx` | Four tabs | 2 |
| `app/_layout.tsx` | Register stack screens, mount providers | 2 |
| `app/(tabs)/index.tsx` | Rebuild Home on hooks and sections | 2 |
| `app/video/[id].tsx` | Rebuild on container, services, and states | 3 |
| `components/VideoPlayer/modals/VideoShareSheet.tsx` | Share the app deep link through the system sheet | 3 |
| `components/VideoPlayer/modals/VideoSaveSheet.tsx` | Replace playlist UI with a single Saved toggle | 4 |
| `contexts/VideoPlayerContext.tsx` | Renamed to `PlayQueueContext.tsx`, narrowed | 3 |

### 4.3 Files to delete or relocate

Delete only after `grep -rn "<basename>" app components contexts hooks services utils __tests__` proves no importer remains.

| Path | Action | Increment |
|---|---|---|
| `components/VideoPlayer/hooks/useVideoPlayer.ts` | Delete (dead, imports expo-av) | 0B |
| `components/VideoPlayer/AutoplayToggleDemo.tsx` | Delete | 0B |
| `components/VideoPlayer/YouTubeControlsDemo.tsx` | Delete | 0B |
| `components/VideoPlayer/ControlsWithNavigation.example.tsx` | Delete | 0B |
| `components/VideoPlayer/*.md` (7 files) | Move to `docs/history/videoplayer/` | 0B |
| `ThemeTest.tsx` (repo root) | Delete | 1 |
| `constants/ThemeTest.tsx` | Delete | 1 |
| `app/(tabs)/explore.tsx` | Delete | 2 |
| `app/modal.tsx` | Delete | 2 |
| `app/video/VideoCard.tsx` | Delete (duplicate of `components/VideoFeed/VideoCard.tsx`) | 2 |
| `components/parallax-scroll-view.tsx`, `components/hello-wave.tsx`, `components/ui/collapsible.tsx`, `components/external-link.tsx` | Delete after import check | 2 |
| `@react-navigation/drawer` | Remove from `package.json` after import check | 2 |
| `services/videoService.ts` | Delete after `contentService` migration | 3 |
| `hooks/useVoiceSearch.ts` | Move to `docs/history/unused/` (imports uninstalled expo-speech) | 7 |
| ~45 root-level `*.md` delivery notes | Move to `docs/history/` | 7 |

---

## 5. Shared Contracts

Copy these verbatim. Increment plans reference them by name and never restate them.

### 5.1 `types/result.ts`

```ts
// types/result.ts
/** Stable error codes. UI maps these to states; never show raw exceptions. */
export type AppErrorCode =
  | "network"
  | "timeout"
  | "not_found"
  | "invalid_source"
  | "unsupported_source"
  | "storage"
  | "validation"
  | "unknown";

/** The only error shape that crosses a service boundary. */
export interface AppError {
  readonly code: AppErrorCode;
  /** Safe to render to a user. Never contains a URL, stack, or personal data. */
  readonly message: string;
  /** Logged only, never rendered. */
  readonly cause?: unknown;
}

export type LoadStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "offline";

/** Uniform return shape for every feature hook. */
export interface Loadable<T> {
  readonly status: LoadStatus;
  readonly data: T | null;
  readonly error: AppError | null;
  readonly retry: () => void;
}

/** Loadable plus pagination, for list hooks. */
export interface PagedLoadable<T> extends Loadable<T[]> {
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly loadMore: () => void;
}
```

### 5.2 `types/domain.ts`

```ts
// types/domain.ts
export interface Channel {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl?: string;
}

/** What a backend claims about a media source. Untrusted until resolved. */
export interface SourceDescriptor {
  readonly kind: "hls" | "mp4" | "youtube";
  readonly url: string;
}

/** Output of mediaSourceResolver.resolvePlayable. Never "youtube". */
export interface PlayableSource {
  readonly kind: "hls" | "mp4";
  readonly url: string;
}

/** Output of mediaSourceResolver.resolveEmbed. */
export interface EmbedTarget {
  readonly embedUrl: string;
  readonly allowedOrigins: readonly string[];
}

export interface CaptionItem {
  readonly start: number;
  readonly end?: number | null;
  readonly text: string;
}

export interface ChapterItem {
  readonly title: string;
  readonly startMs: number;
}

export interface Video {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly thumbnailUrl: string;
  readonly durationSec: number;
  readonly publishedAt: string; // ISO 8601
  readonly viewCount?: number;
  readonly channel: Channel;
  readonly isLive: boolean;
  readonly source: SourceDescriptor;
  readonly captions?: readonly CaptionItem[];
  readonly chapters?: readonly ChapterItem[];
  readonly tags?: readonly string[];
}

export interface LiveSession {
  readonly id: string;
  readonly title: string;
  readonly thumbnailUrl: string;
  readonly startsAt: string; // ISO 8601
  readonly endedAt?: string;
  readonly source: SourceDescriptor;
  readonly replayVideoId?: string;
}

export type LiveState = "live" | "upcoming" | "ended" | "none";

export interface LiveStatus {
  readonly state: LiveState;
  readonly session?: LiveSession;
  readonly checkedAt: string; // ISO 8601
}
```

> **Migration note.** The existing `types/video.ts` exports `VideoMetadata` with `videoUrl`, `duration`, `views`, `channelName`, `channelAvatar`, `channelId`. It stays untouched until Increment 3, which introduces `toVideo(meta: VideoMetadata): Video` in `services/contentService.ts` and switches consumers. Do not edit `types/video.ts` before then; `components/Shorts/` and `components/VideoFeed/` depend on it.

### 5.3 `services/appError.ts`

```ts
// services/appError.ts
import type { AppError, AppErrorCode } from "../types/result";

const SAFE_MESSAGES: Record<AppErrorCode, string> = {
  network: "No connection. Check your network and try again.",
  timeout: "This is taking too long. Try again.",
  not_found: "This content is not available.",
  invalid_source: "This video cannot be played.",
  unsupported_source: "This format is not supported on your device.",
  storage: "Could not save your changes on this device.",
  validation: "That input is not valid.",
  unknown: "Something went wrong. Try again.",
};

export function makeError(code: AppErrorCode, cause?: unknown): AppError {
  return { code, message: SAFE_MESSAGES[code], cause };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as AppError).message === "string"
  );
}

/** Last-resort mapping for anything thrown outside a service. */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  return makeError("unknown", value);
}
```

### 5.4 `constants/config.ts` (exact values)

```ts
// constants/config.ts
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
```

### 5.5 `hooks/useLoadable.ts` — the shared status machine

Every feature hook is built on this. It owns the stale-response guard and unmount cancellation so no hook reimplements them.

```ts
// hooks/useLoadable.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppError, Loadable, LoadStatus } from "../types/result";
import { toAppError } from "../services/appError";

interface UseLoadableOptions<T> {
  /** Must be stable (wrap in useCallback in the caller). */
  readonly load: () => Promise<T>;
  /** Called to decide whether a successful result counts as empty. */
  readonly isEmpty?: (data: T) => boolean;
  /** When false, the hook stays idle and does not call load. */
  readonly enabled?: boolean;
}

export function useLoadable<T>({
  load,
  isEmpty,
  enabled = true,
}: UseLoadableOptions<T>): Loadable<T> {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  /** Incremented per request; only the newest may commit state. */
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    const id = ++requestIdRef.current;
    setStatus("loading");
    setError(null);

    load()
      .then((result) => {
        if (!mountedRef.current || id !== requestIdRef.current) return;
        setData(result);
        setStatus(isEmpty?.(result) ? "empty" : "success");
      })
      .catch((caught: unknown) => {
        if (!mountedRef.current || id !== requestIdRef.current) return;
        const appError = toAppError(caught);
        setError(appError);
        setStatus(appError.code === "network" ? "offline" : "error");
      });
  }, [load, isEmpty, enabled, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { status, data, error, retry };
}
```

**Contract for every feature hook:** return `Loadable<T>` or `PagedLoadable<T>`. Never expose a raw `setState`. Never call a service outside `load`.

### 5.6 Service signatures

Implement exactly these. Later increments call them by name.

```ts
// services/contentSourceConfig.ts
export type ContentMode = "production" | "development";
export interface ContentSourceConfig {
  readonly mode: ContentMode;
  readonly apiBaseUrl: string;
  readonly allowedMediaHosts: readonly string[];
  readonly liveSourceFallback: "youtube" | "none";
}
export function getContentSourceConfig(): ContentSourceConfig;

// services/httpClient.ts
export interface HttpGetOptions<T> {
  readonly path: string;
  readonly guard: (value: unknown) => value is T;
  readonly signal?: AbortSignal;
}
/** Rejects with AppError. Never throws a raw Error. */
export function httpGet<T>(options: HttpGetOptions<T>): Promise<T>;

// services/contentService.ts
export function getFeatured(): Promise<Video | null>;
export function getLatest(page: number): Promise<{ videos: Video[]; hasMore: boolean }>;
export function getVideoById(id: string): Promise<Video>;          // rejects AppError("not_found")
export function getVideosByIds(ids: readonly string[]): Promise<Video[]>; // missing ids omitted
export function getRelated(id: string): Promise<Video[]>;
export function search(query: string, page: number): Promise<{ videos: Video[]; hasMore: boolean }>;

// services/mediaSourceResolver.ts
export function resolvePlayable(input: Video | LiveSession): PlayableSource; // throws AppError
export function resolveEmbed(session: LiveSession): EmbedTarget;             // throws AppError

// services/liveService.ts
export function getLiveStatus(signal?: AbortSignal): Promise<LiveStatus>;
export function getRecentSessions(): Promise<LiveSession[]>;

// services/shareLinkService.ts
export function forVideo(id: string): string;
export function forLive(): string;

// services/analytics.ts
export type AnalyticsEvent = "video_start" | "video_finish" | "live_join";
export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean>): void;

// services/storage/asyncStorageAdapter.ts
export function readJson<T>(key: string, guard: (v: unknown) => v is T, fallback: T): Promise<T>;
export function writeJson(key: string, value: unknown): Promise<void>; // rejects AppError("storage")
export function removeKey(key: string): Promise<void>;

// services/storage/savedStorage.ts
export interface SavedState { readonly savedIds: string[]; readonly likedIds: string[] }
export function readSaved(): Promise<SavedState>;   // corrupt payload resets to empty, logs
export function writeSaved(state: SavedState): Promise<void>;

// services/storage/settingsStorage.ts
export type ThemePreference = "system" | "light" | "dark";
export interface Settings { readonly theme: ThemePreference; readonly autoplayDefault: boolean }
export function readSettings(): Promise<Settings>;   // defaults { theme: "system", autoplayDefault: true }
export function writeSettings(settings: Settings): Promise<void>;
export function readRecentSearches(): Promise<string[]>;
export function writeRecentSearches(queries: readonly string[]): Promise<void>;
```

### 5.7 Context contracts

```ts
// contexts/PlayQueueContext.tsx
export interface PlayQueueValue {
  readonly queue: readonly Video[];
  readonly currentIndex: number;
  readonly currentVideo: Video | null;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayEnabled: boolean;
  setQueue(videos: readonly Video[], startId?: string): void;
  playById(id: string): void;
  playNext(): boolean;
  playPrevious(): boolean;
  setAutoplay(enabled: boolean): void;
}
export function usePlayQueue(): PlayQueueValue; // throws outside provider

// contexts/SavedContext.tsx
export interface SavedValue {
  readonly savedIds: readonly string[];  // most recent first
  readonly hydrated: boolean;
  isSaved(id: string): boolean;
  isLiked(id: string): boolean;
  toggleSave(id: string): void;
  toggleLike(id: string): void;
}
export function useSaved(): SavedValue;

// contexts/SettingsContext.tsx   (see deviation D1)
export interface SettingsValue {
  readonly theme: ThemePreference;
  readonly autoplayDefault: boolean;
  readonly hydrated: boolean;
  setTheme(theme: ThemePreference): void;
  setAutoplayDefault(enabled: boolean): void;
}
export function useSettings(): SettingsValue;
```

### 5.8 `components/ui/StateView.tsx` contract

```ts
export interface StateViewProps {
  readonly status: LoadStatus;
  readonly error?: AppError | null;
  readonly onRetry?: () => void;
  /** Rendered when status is "empty". */
  readonly emptyTitle?: string;
  readonly emptyHint?: string;
  /** Rendered while loading. Defaults to a spinner. */
  readonly loadingSkeleton?: React.ReactNode;
  readonly testID?: string;
}
```

Render rules: `idle` renders nothing. `loading` renders `loadingSkeleton` or a spinner. `success` renders nothing (the caller renders content). `empty`, `error`, `offline` render an icon, a message, and a retry button when `onRetry` is given. Error and offline text come from `error.message`, never from a hard-coded string.

### 5.9 `components/Video/VideoPlaybackContainer.tsx` contract

```ts
export interface VideoPlaybackContainerProps {
  readonly video: Video;
  readonly source: PlayableSource;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayEnabled: boolean;
  readonly isMinimized: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onFinished: () => void;
  readonly onToggleMinimize: () => void;
  readonly onFullscreenChange: (isFullscreen: boolean) => void;
}
```

It renders exactly one element: `<VideoPlayer ... />` with the frozen prop surface below. It adds no view wrapper, no network call, and no playback-state reads.

**Frozen VideoPlayer prop surface** (verified against `components/VideoPlayer/index.tsx` lines 58-115; do not add to it):

```
sourceUrl, autoplay, buttonSize,
hasPreviousVideo, hasNextVideo, onNavigateToPrevious, onNavigateToNext,
isMinimized, onToggleMinimize,
onFullscreenChange,
isAutoplayEnabled, onVideoFinished,
captions, chapters, hideControlsTimeout, theme,
videoId, videoTitle, videoUrl, channelId
```

Mapping (container prop → player prop): `source.url → sourceUrl`, `hasPrevious → hasPreviousVideo`, `hasNext → hasNextVideo`, `onPrevious → onNavigateToPrevious`, `onNext → onNavigateToNext`, `onFinished → onVideoFinished`, `video.id → videoId`, `video.title → videoTitle`, `source.url → videoUrl`, `video.channel.id → channelId`, `video.captions → captions`, `video.chapters → chapters`.

**`videoId` must always be a non-empty string.** The player hides its action bar and progress bar when `videoId` is falsy (`index.tsx:909`, `:946`).

---

## 6. Conventions

**Naming.** Components and contexts `PascalCase.tsx`. Hooks `useThing.ts`. Services `thingService.ts` or `thing.ts`. Types `camelCase.ts`. Constants `SCREAMING_SNAKE` inside a `const` object with `as const`.

**Logging.** `import Logger from "../utils/Logger"` and call `Logger.info("[Scope]", message)`. The first argument is the scope. Never log a full URL with a query string, and never log anything that identifies a person.

**Testing.** Tests live under `__tests__/<area>/<name>.test.ts(x)` because `package.json` `testMatch` is `**/__tests__/**/*.test.[jt]s?(x)`. Use React Native Testing Library. Query by `testID` for structure and by accessible text for content. Every new component takes an optional `testID` prop and spreads it onto its root element.

**Accessibility.** Every interactive element sets `accessibilityRole` and `accessibilityLabel`. Minimum touch target 44 points.

**Commits.** One commit per completed task, message in Conventional Commits form, body listing what was verified.

---

## 7. Verification Commands

Only these. Never invent a script name.

```bash
npx tsc --noEmit                        # type gate
npm run lint                            # eslint
npm test                                # jest (works only after Increment 0A)
npm test -- --testPathPattern=<pattern> # a single suite
npm start                               # Expo dev server for manual checks
```

**Gate before every commit:** `npx tsc --noEmit` must not introduce new errors, and `npm test` must pass.
**Gate before closing an increment:** zero new lint errors, and the increment's own manual checklist completed.

---

## 8. Manual Verification Matrix (human-run, Increment 7)

Automated tests cannot cover real playback. The human runs this on a physical Android device and a physical iOS device.

| # | Check | Pass criterion |
|---|---|---|
| 1 | Play an MP4 from Home | Video starts, controls respond, seek works |
| 2 | Play an HLS `.m3u8` from Home | Same |
| 3 | Rotate to landscape mid-playback | Fullscreen engages, position preserved |
| 4 | Return to portrait | Chrome restored, no black bars |
| 5 | Background the app during playback | Audio and video stop, no crash on resume |
| 6 | Navigate away mid-playback | Playback stops, no orphaned audio |
| 7 | Autoplay to next video | Next video loads, queue index advances |
| 8 | Save a video, force-quit, relaunch | Video still in Saved tab |
| 9 | Airplane mode on Home | Offline state with retry, no crash |
| 10 | Airplane mode off, tap retry | Content loads |
| 11 | Live tab with an HLS stream | Stream plays, live badge shown |
| 12 | Live tab with a YouTube source | Embed plays, no navigation outside the allowlist |
| 13 | Live stream ends while watching | Ended overlay appears, replay button works if a replay exists |
| 14 | Deep link `expoliveplayer://video/<id>` | Opens that video |
| 15 | Deep link with an unknown id | Lands on Home, no crash, no dialog |
| 16 | Shorts tab | Unchanged behavior from before the MVP work |
