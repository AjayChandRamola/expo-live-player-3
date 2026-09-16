# Increment 5 — App Actions and Repositories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, inline in this session (CLAUDE.md §0 forbids subagents). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-09-16-video-player-00-index.md` first. Increment 0 must be merged. This increment is independent of Increments 1–4 and may run on its own branch in parallel.

**Goal:** Move every app action out of the player into `components/Video/actions/`, back them with a backend-agnostic repository (local implementation shipped), implement real MP4 downloads, and build the Thanks flow against a payment-provider interface, while the old player keeps compiling and rendering.

**Architecture:** ADRs 0006–0009. `VideoActionsRepository` interface + `localVideoActionsRepository` (AsyncStorage through the existing adapter). `downloadService` over `expo-file-system/legacy` with a persisted registry. `PaymentProvider` interface + `unavailablePaymentProvider`. `VideoActionsProvider` injects them. `useVideoActions` is rewritten with optimistic updates, rollback, in-flight guards and sequence numbers. Sheets relocate with `git mv`; the old root gets an import-path-only edit.

**Tech Stack:** expo-file-system ~19.0.17 (`/legacy` subpath), AsyncStorage via `services/storage/asyncStorageAdapter.ts`, RNTL 13.

**Spec:** `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §5.3; `docs/player/07-app-actions-and-repositories.md` (all sections); `docs/player/02-feature-catalog.md` F29–F38.

## Global Constraints

See the index. Additionally:
- Only `services/storage/asyncStorageAdapter.ts` imports AsyncStorage; only `services/httpClient.ts` calls `fetch` (no network here at all).
- User-facing error text comes only from `AppError.message` (`services/appError.ts`).
- No fake success: `unavailablePaymentProvider` never resolves a payment; the clip editor says "saved to this device".
- The old `components/VideoPlayer/index.tsx` is edited **once**, import paths only (Task 10), in its own commit.

## File structure produced

```
types/result.ts                         (+ 3 AppErrorCodes)
services/appError.ts                    (+ 3 messages)
services/analytics.ts                   (+ events)
constants/config.ts                     (+ TIMING/LIMITS/STORAGE_KEYS/THANKS_PRESETS/REPORT_REASONS)
services/videoActions/VideoActionsRepository.ts
services/videoActions/localVideoActionsRepository.ts
services/videoActions/PaymentProvider.ts
services/videoActions/unavailablePaymentProvider.ts
services/videoActions/downloadService.ts
services/storage/downloadsStorage.ts
services/storage/videoActionsStorage.ts
components/Video/actions/VideoActionsProvider.tsx
components/Video/actions/useVideoActions.ts
components/Video/actions/VideoActionBar.tsx            (git mv)
components/Video/actions/VideoActionButton.tsx         (git mv)
components/Video/actions/sheets/SaveSheet.tsx          (git mv)
components/Video/actions/sheets/ShareSheet.tsx         (git mv)
components/Video/actions/sheets/DownloadSheet.tsx      (git mv + rewrite)
components/Video/actions/sheets/ClipEditor.tsx         (git mv + rewire)
components/Video/actions/sheets/OverflowMenu.tsx       (git mv + trim)
components/Video/actions/sheets/ReportSheet.tsx        (new)
components/Video/actions/sheets/ThanksSheet.tsx        (new)
__tests__/services/videoActions/*.test.ts
__tests__/components/actions/*.test.tsx                (moved + new)
```

---

### Task 1: Error codes, analytics events, constants

**Files:**
- Modify: `types/result.ts`, `services/appError.ts`, `services/analytics.ts`, `constants/config.ts`
- Test: `__tests__/services/appError.codes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/services/appError.codes.test.ts
import { makeError } from "../../services/appError";
import { LIMITS, REPORT_REASONS, STORAGE_KEYS, THANKS_PRESETS, TIMING } from "../../constants/config";

describe("new error codes and constants", () => {
  it.each(["storage_full", "payments_unavailable", "unauthorized"] as const)("%s has a safe message", (code) => {
    const error = makeError(code);
    expect(error.code).toBe(code);
    expect(error.message.length).toBeGreaterThan(10);
  });
  it("defines the action constants", () => {
    expect(STORAGE_KEYS.videoActions).toBe("yagna.videoActions.v1");
    expect(STORAGE_KEYS.downloads).toBe("yagna.downloads.v1");
    expect(TIMING.downloadProgressThrottleMs).toBe(500);
    expect(LIMITS.maxConcurrentDownloads).toBe(1);
    expect(LIMITS.clipMinMs).toBeLessThan(LIMITS.clipMaxMs);
    expect(THANKS_PRESETS.length).toBeGreaterThan(0);
    expect(REPORT_REASONS).toContain("other");
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

In `types/result.ts`, extend the union:
```ts
export type AppErrorCode =
  | "network"
  | "timeout"
  | "not_found"
  | "invalid_source"
  | "unsupported_source"
  | "storage"
  | "storage_full"
  | "payments_unavailable"
  | "unauthorized"
  | "validation"
  | "unknown";
```

In `services/appError.ts`, add to `SAFE_MESSAGES`:
```ts
  storage_full: "Not enough space on this device to download.",
  payments_unavailable: "Thanks is coming soon.",
  unauthorized: "Please sign in to do that.",
```

In `services/analytics.ts`, extend the union:
```ts
export type AnalyticsEvent =
  | "video_start" | "video_finish" | "video_progress" | "live_join"
  | "action_like" | "action_dislike" | "action_not_interested" | "action_save" | "action_share" | "action_failed"
  | "download_start" | "download_complete" | "download_fail"
  | "clip_create" | "report_submit" | "thanks_open";
```

In `constants/config.ts`, add:
```ts
// inside TIMING
  downloadProgressThrottleMs: 500,
// inside LIMITS
  maxConcurrentDownloads: 1,
  downloadMinFreeBytes: 200 * 1024 * 1024,
  clipMinMs: 1_000,
  clipMaxMs: 60_000,
  reportDetailsMaxLength: 500,
// inside STORAGE_KEYS
  videoActions: "yagna.videoActions.v1",
  downloads: "yagna.downloads.v1",
// new exports
export const THANKS_PRESETS = [
  { amountMinor: 5_100, currency: "INR", label: "₹51" },
  { amountMinor: 10_100, currency: "INR", label: "₹101" },
  { amountMinor: 50_100, currency: "INR", label: "₹501" },
  { amountMinor: 100_100, currency: "INR", label: "₹1,001" },
] as const;

export const REPORT_REASONS = ["inappropriate", "spam", "misleading", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
```

- [ ] **Step 3: Run, then whole suite (the union change must not break existing tests), commit**

```bash
git checkout -b feature/player-5-actions
git add types/result.ts services/appError.ts services/analytics.ts constants/config.ts __tests__/services/appError.codes.test.ts
git commit -m "feat(actions): add error codes, analytics events and constants for app actions

Verified: npm test => <N> suites passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Repository interface and local implementation

**Files:**
- Create: `services/videoActions/VideoActionsRepository.ts`, `services/storage/videoActionsStorage.ts`, `services/videoActions/localVideoActionsRepository.ts`
- Test: `__tests__/services/videoActions/localVideoActionsRepository.test.ts`

**Interfaces:** exactly `docs/player/07-app-actions-and-repositories.md` §2 plus:
```ts
export function createLocalVideoActionsRepository(deps?: { readonly now?: () => string; readonly writeDelayMs?: number }): VideoActionsRepository & { flush(): Promise<void> }
export const localVideoActionsRepository: VideoActionsRepository
```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/services/videoActions/localVideoActionsRepository.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createLocalVideoActionsRepository } from "../../../services/videoActions/localVideoActionsRepository";
import { STORAGE_KEYS } from "../../../constants/config";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const repo = () => createLocalVideoActionsRepository({ now: () => "2026-09-16T00:00:00.000Z", writeDelayMs: 0 });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("localVideoActionsRepository", () => {
  it("returns defaults for an unknown video with counts null", async () => {
    const state = await repo().getState("v1");
    expect(state).toEqual({ videoId: "v1", liked: false, disliked: false, reported: false, notInterested: false, counts: null, updatedAt: "2026-09-16T00:00:00.000Z" });
  });

  it("like and dislike are mutually exclusive and persist across instances", async () => {
    const a = repo();
    await a.setLike("v1", true);
    expect((await a.setDislike("v1", true))).toMatchObject({ liked: false, disliked: true });
    await a.flush();
    const b = repo();
    expect(await b.getState("v1")).toMatchObject({ liked: false, disliked: true });
  });

  it("idempotent: setting the same value performs no write", async () => {
    const a = repo();
    await a.setLike("v1", true);
    await a.flush();
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    await a.setLike("v1", true);
    await a.flush();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("report is idempotent and validates details length", async () => {
    const a = repo();
    expect((await a.report("v1", "spam")).reported).toBe(true);
    expect((await a.report("v1", "other", "again")).reported).toBe(true);
    await expect(a.report("v2", "other", "x".repeat(501))).rejects.toMatchObject({ code: "validation" });
  });

  it("hidden channels round-trip", async () => {
    const a = repo();
    await a.setChannelHidden("c1", true);
    expect(await a.isChannelHidden("c1")).toBe(true);
    await a.setChannelHidden("c1", false);
    expect(await a.isChannelHidden("c1")).toBe(false);
  });

  it("clips validate bounds and list per video", async () => {
    const a = repo();
    const clip = await a.createClip("v1", 1_000, 5_000);
    expect(clip).toMatchObject({ videoId: "v1", startMs: 1_000, endMs: 5_000 });
    expect(await a.listClips("v1")).toHaveLength(1);
    await expect(a.createClip("v1", 5_000, 5_500)).rejects.toMatchObject({ code: "validation" }); // < clipMinMs
    await expect(a.createClip("v1", 0, 61_000)).rejects.toMatchObject({ code: "validation" }); // > clipMaxMs
  });

  it("corrupt payload resets to empty", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.videoActions, "{not json");
    expect((await repo().getState("v1")).liked).toBe(false);
    await AsyncStorage.setItem(STORAGE_KEYS.videoActions, JSON.stringify({ version: 99 }));
    expect((await repo().getState("v1")).liked).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```ts
// services/videoActions/VideoActionsRepository.ts
import type { ReportReason } from "../../constants/config";

export type { ReportReason };

export interface VideoActionCounts {
  readonly likes: number;
  readonly dislikes: number;
}

export interface VideoActionState {
  readonly videoId: string;
  readonly liked: boolean;
  readonly disliked: boolean;
  readonly reported: boolean;
  readonly notInterested: boolean;
  /** null when the implementation has no counts (local). */
  readonly counts: VideoActionCounts | null;
  readonly updatedAt: string;
}

export interface ClipRecord {
  readonly id: string;
  readonly videoId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly createdAt: string;
}

export interface VideoActionsRepository {
  getState(videoId: string): Promise<VideoActionState>;
  setLike(videoId: string, liked: boolean): Promise<VideoActionState>;
  setDislike(videoId: string, disliked: boolean): Promise<VideoActionState>;
  report(videoId: string, reason: ReportReason, details?: string): Promise<VideoActionState>;
  setNotInterested(videoId: string, value: boolean): Promise<VideoActionState>;
  setChannelHidden(channelId: string, hidden: boolean): Promise<void>;
  isChannelHidden(channelId: string): Promise<boolean>;
  createClip(videoId: string, startMs: number, endMs: number): Promise<ClipRecord>;
  listClips(videoId: string): Promise<readonly ClipRecord[]>;
}
```

```ts
// services/storage/videoActionsStorage.ts
import { STORAGE_KEYS } from "../../constants/config";
import { readJson, writeJson } from "./asyncStorageAdapter";
import type { ClipRecord, VideoActionState } from "../videoActions/VideoActionsRepository";

export type StoredVideoState = Omit<VideoActionState, "videoId" | "counts">;

export interface VideoActionsPayloadV1 {
  readonly version: 1;
  readonly videos: Record<string, StoredVideoState>;
  readonly hiddenChannels: readonly string[];
  readonly clips: readonly ClipRecord[];
}

export const EMPTY_VIDEO_ACTIONS: VideoActionsPayloadV1 = { version: 1, videos: {}, hiddenChannels: [], clips: [] };

function isPayload(value: unknown): value is VideoActionsPayloadV1 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<VideoActionsPayloadV1>;
  return v.version === 1 && typeof v.videos === "object" && v.videos !== null && Array.isArray(v.hiddenChannels) && Array.isArray(v.clips);
}

export function readVideoActions(): Promise<VideoActionsPayloadV1> {
  return readJson(STORAGE_KEYS.videoActions, isPayload, EMPTY_VIDEO_ACTIONS);
}

export function writeVideoActions(payload: VideoActionsPayloadV1): Promise<void> {
  return writeJson(STORAGE_KEYS.videoActions, payload);
}
```

```ts
// services/videoActions/localVideoActionsRepository.ts
// AsyncStorage-backed implementation (ADR 0007). In-memory cache, debounced write-through.
import { LIMITS, TIMING } from "../../constants/config";
import { makeError } from "../appError";
import { readVideoActions, writeVideoActions, type StoredVideoState, type VideoActionsPayloadV1 } from "../storage/videoActionsStorage";
import type { ClipRecord, ReportReason, VideoActionState, VideoActionsRepository } from "./VideoActionsRepository";

interface Deps {
  readonly now?: () => string;
  readonly writeDelayMs?: number;
}

const DEFAULT_STATE = (now: string): StoredVideoState => ({ liked: false, disliked: false, reported: false, notInterested: false, updatedAt: now });

export function createLocalVideoActionsRepository(deps: Deps = {}): VideoActionsRepository & { flush(): Promise<void> } {
  const now = deps.now ?? (() => new Date().toISOString());
  const writeDelayMs = deps.writeDelayMs ?? TIMING.savedWriteDebounceMs;
  let cache: VideoActionsPayloadV1 | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingWrite: Promise<void> | null = null;

  const load = async (): Promise<VideoActionsPayloadV1> => {
    if (cache === null) cache = await readVideoActions();
    return cache;
  };

  const scheduleWrite = (next: VideoActionsPayloadV1): void => {
    cache = next;
    if (timer !== null) clearTimeout(timer);
    pendingWrite = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        timer = null;
        writeVideoActions(next).then(resolve, reject);
      }, writeDelayMs);
    });
  };

  const toState = (videoId: string, stored: StoredVideoState): VideoActionState => ({ videoId, ...stored, counts: null });

  const update = async (videoId: string, patch: Partial<StoredVideoState>): Promise<VideoActionState> => {
    const data = await load();
    const current = data.videos[videoId] ?? DEFAULT_STATE(now());
    const changed = (Object.keys(patch) as (keyof StoredVideoState)[]).some((k) => current[k] !== patch[k]);
    if (!changed) return toState(videoId, current);
    const nextState: StoredVideoState = { ...current, ...patch, updatedAt: now() };
    scheduleWrite({ ...data, videos: { ...data.videos, [videoId]: nextState } });
    return toState(videoId, nextState);
  };

  return {
    async getState(videoId) {
      const data = await load();
      return toState(videoId, data.videos[videoId] ?? DEFAULT_STATE(now()));
    },
    setLike: (videoId, liked) => update(videoId, liked ? { liked: true, disliked: false } : { liked: false }),
    setDislike: (videoId, disliked) => update(videoId, disliked ? { disliked: true, liked: false } : { disliked: false }),
    async report(videoId, _reason: ReportReason, details) {
      if (details !== undefined && details.length > LIMITS.reportDetailsMaxLength) throw makeError("validation");
      return update(videoId, { reported: true });
    },
    setNotInterested: (videoId, value) => update(videoId, { notInterested: value }),
    async setChannelHidden(channelId, hidden) {
      const data = await load();
      const has = data.hiddenChannels.includes(channelId);
      if (has === hidden) return;
      scheduleWrite({ ...data, hiddenChannels: hidden ? [...data.hiddenChannels, channelId] : data.hiddenChannels.filter((c) => c !== channelId) });
    },
    async isChannelHidden(channelId) {
      return (await load()).hiddenChannels.includes(channelId);
    },
    async createClip(videoId, startMs, endMs) {
      const length = endMs - startMs;
      if (startMs < 0 || length < LIMITS.clipMinMs || length > LIMITS.clipMaxMs) throw makeError("validation");
      const data = await load();
      const clip: ClipRecord = { id: `${videoId}:${Date.now()}`, videoId, startMs, endMs, createdAt: now() };
      scheduleWrite({ ...data, clips: [...data.clips, clip] });
      return clip;
    },
    async listClips(videoId) {
      return (await load()).clips.filter((c) => c.videoId === videoId);
    },
    async flush() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        if (cache) await writeVideoActions(cache);
        pendingWrite = null;
        return;
      }
      if (pendingWrite) await pendingWrite;
    },
  };
}

export const localVideoActionsRepository: VideoActionsRepository = createLocalVideoActionsRepository();
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern=localVideoActionsRepository` → 7 passed. If the AsyncStorage jest mock path differs, check `node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js` exists; the existing `__tests__/contexts/SavedContext.test.tsx` shows how this project mocks it — reuse that approach.

```bash
git add services/videoActions/VideoActionsRepository.ts services/storage/videoActionsStorage.ts services/videoActions/localVideoActionsRepository.ts __tests__/services/videoActions/localVideoActionsRepository.test.ts
git commit -m "feat(actions): add VideoActionsRepository interface and local AsyncStorage implementation

Verified: npm test -- --testPathPattern=localVideoActionsRepository => 7 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Payment provider interface and the unavailable provider

**Files:**
- Create: `services/videoActions/PaymentProvider.ts`, `services/videoActions/unavailablePaymentProvider.ts`
- Test: `__tests__/services/videoActions/unavailablePaymentProvider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/services/videoActions/unavailablePaymentProvider.test.ts
import { unavailablePaymentProvider } from "../../../services/videoActions/unavailablePaymentProvider";
import { THANKS_PRESETS } from "../../../constants/config";

describe("unavailablePaymentProvider", () => {
  it("is not available, returns presets, and rejects intents", async () => {
    expect(unavailablePaymentProvider.isAvailable).toBe(false);
    await expect(unavailablePaymentProvider.getPresets()).resolves.toEqual([...THANKS_PRESETS]);
    await expect(unavailablePaymentProvider.createIntent("v1", 5_100, "INR")).rejects.toMatchObject({ code: "payments_unavailable" });
    await expect(unavailablePaymentProvider.confirm("x")).rejects.toMatchObject({ code: "payments_unavailable" });
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```ts
// services/videoActions/PaymentProvider.ts
export interface ThanksPreset {
  readonly amountMinor: number;
  readonly currency: "INR";
  readonly label: string;
}
export interface PaymentIntent {
  readonly id: string;
  readonly amountMinor: number;
  readonly currency: string;
}
export type PaymentResult =
  | { readonly status: "succeeded"; readonly receiptId: string }
  | { readonly status: "cancelled" }
  | { readonly status: "failed"; readonly code: string };

export interface PaymentProvider {
  readonly isAvailable: boolean;
  getPresets(): Promise<readonly ThanksPreset[]>;
  createIntent(videoId: string, amountMinor: number, currency: string): Promise<PaymentIntent>;
  confirm(intentId: string): Promise<PaymentResult>;
}
```

```ts
// services/videoActions/unavailablePaymentProvider.ts
// The only shipped provider (ADR 0009). Never reports a successful payment.
import { THANKS_PRESETS } from "../../constants/config";
import { makeError } from "../appError";
import type { PaymentProvider } from "./PaymentProvider";

export const unavailablePaymentProvider: PaymentProvider = {
  isAvailable: false,
  getPresets: async () => [...THANKS_PRESETS],
  createIntent: async () => {
    throw makeError("payments_unavailable");
  },
  confirm: async () => {
    throw makeError("payments_unavailable");
  },
};
```

- [ ] **Step 3: Run and commit**

```bash
git add services/videoActions/PaymentProvider.ts services/videoActions/unavailablePaymentProvider.ts __tests__/services/videoActions/unavailablePaymentProvider.test.ts
git commit -m "feat(actions): add PaymentProvider interface and unavailable provider

Verified: npm test -- --testPathPattern=unavailablePaymentProvider => 1 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Download registry storage and download service

**Files:**
- Create: `services/storage/downloadsStorage.ts`, `services/videoActions/downloadService.ts`
- Test: `__tests__/services/videoActions/downloadService.test.ts`

**Interfaces:** `docs/player/07-app-actions-and-repositories.md` §5.1–§5.2, plus `createDownloadService(deps?: { fs?: DownloadFs; now?: () => string }): DownloadService` where `DownloadFs` is the subset of `expo-file-system/legacy` used (for tests).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/services/videoActions/downloadService.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createDownloadService, type DownloadFs } from "../../../services/videoActions/downloadService";
import { STORAGE_KEYS } from "../../../constants/config";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

type Progress = (data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void;

function fakeFs() {
  const files = new Set<string>();
  let onProgress: Progress | null = null;
  let resolveDownload: ((r: { uri: string } | undefined) => void) | null = null;
  const resumable = {
    downloadAsync: jest.fn(() => new Promise<{ uri: string } | undefined>((resolve) => { resolveDownload = resolve; })),
    pauseAsync: jest.fn(async () => ({ resumeData: "RESUME" })),
    resumeAsync: jest.fn(() => new Promise<{ uri: string } | undefined>((resolve) => { resolveDownload = resolve; })),
    cancelAsync: jest.fn(async () => undefined),
    savable: jest.fn(() => ({ url: "u", fileUri: "f", options: {}, resumeData: "RESUME" })),
  };
  const fs: DownloadFs = {
    documentDirectory: "file:///docs/",
    makeDirectoryAsync: jest.fn(async () => undefined),
    getInfoAsync: jest.fn(async (uri: string) => ({ exists: files.has(uri), uri, isDirectory: false })),
    deleteAsync: jest.fn(async (uri: string) => { files.delete(uri); }),
    getFreeDiskStorageAsync: jest.fn(async () => 10 * 1024 * 1024 * 1024),
    createDownloadResumable: jest.fn((_url: string, fileUri: string, _opts: unknown, cb?: Progress) => {
      onProgress = cb ?? null;
      return { ...resumable, fileUri };
    }),
  };
  return {
    fs,
    resumable,
    progress: (written: number, total: number) => onProgress?.({ totalBytesWritten: written, totalBytesExpectedToWrite: total }),
    complete: (uri: string) => { files.add(uri); resolveDownload?.({ uri }); },
    files,
  };
}

const MP4 = { id: "v1", url: "https://cdn.test/v1.mp4", kind: "mp4" as const };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useRealTimers();
});

describe("downloadService", () => {
  it("rejects HLS", async () => {
    const { fs } = fakeFs();
    await expect(createDownloadService({ fs }).start({ ...MP4, kind: "hls" })).rejects.toMatchObject({ code: "validation" });
  });

  it("start → downloading with throttled progress → completed; resolveLocalUri returns the file", async () => {
    const f = fakeFs();
    const service = createDownloadService({ fs: f.fs });
    const seen: string[] = [];
    service.subscribe((records) => seen.push(records[0]?.status ?? "none"));
    await service.start(MP4);
    expect(f.fs.makeDirectoryAsync).toHaveBeenCalledWith("file:///docs/videos/", { intermediates: true });
    expect((await service.get("v1"))?.status).toBe("downloading");
    f.progress(50, 100);
    await flush();
    expect((await service.get("v1"))?.progress).toBe(0.5);
    f.complete("file:///docs/videos/v1.mp4");
    await flush();
    expect((await service.get("v1"))).toMatchObject({ status: "completed", progress: 1 });
    expect(await service.resolveLocalUri("v1")).toBe("file:///docs/videos/v1.mp4");
    expect(seen).toContain("completed");
  });

  it("pause stores resumeData; resume continues; cancel deletes file and record", async () => {
    const f = fakeFs();
    const service = createDownloadService({ fs: f.fs });
    await service.start(MP4);
    await service.pause("v1");
    expect((await service.get("v1"))).toMatchObject({ status: "paused", resumeData: "RESUME" });
    await service.resume("v1");
    expect((await service.get("v1"))?.status).toBe("downloading");
    await service.cancel("v1");
    expect(f.fs.deleteAsync).toHaveBeenCalledWith("file:///docs/videos/v1.mp4", { idempotent: true });
    expect(await service.get("v1")).toBeNull();
  });

  it("storage full → storage_full error; download error → failed", async () => {
    const f = fakeFs();
    (f.fs.getFreeDiskStorageAsync as jest.Mock).mockResolvedValueOnce(1);
    const service = createDownloadService({ fs: f.fs });
    await expect(service.start(MP4)).rejects.toMatchObject({ code: "storage_full" });
    (f.resumable.downloadAsync as jest.Mock).mockRejectedValueOnce(new Error("net"));
    await service.start(MP4);
    await flush();
    expect((await service.get("v1"))).toMatchObject({ status: "failed", error: "network" });
  });

  it("only one active download; the second queues and starts when the first completes", async () => {
    const f = fakeFs();
    const service = createDownloadService({ fs: f.fs });
    await service.start(MP4);
    await service.start({ id: "v2", url: "https://cdn.test/v2.mp4", kind: "mp4" });
    expect((await service.get("v2"))?.status).toBe("queued");
    f.complete("file:///docs/videos/v1.mp4");
    await flush();
    expect((await service.get("v2"))?.status).toBe("downloading");
  });

  it("a record left in downloading is shown as paused after restart; remove deletes completed files", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.downloads, JSON.stringify({ version: 1, records: [{ videoId: "v9", sourceUrl: "u", fileUri: "file:///docs/videos/v9.mp4", status: "downloading", progress: 0.3, bytesTotal: null, resumeData: "R", error: null, updatedAt: "t" }] }));
    const f = fakeFs();
    const service = createDownloadService({ fs: f.fs });
    expect((await service.get("v9"))?.status).toBe("paused");
    f.files.add("file:///docs/videos/v9.mp4");
    await service.remove("v9");
    expect(await service.get("v9")).toBeNull();
    expect(f.fs.deleteAsync).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```ts
// services/storage/downloadsStorage.ts
import { STORAGE_KEYS } from "../../constants/config";
import { readJson, writeJson } from "./asyncStorageAdapter";

export type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "failed";

export interface DownloadRecord {
  readonly videoId: string;
  readonly sourceUrl: string;
  readonly fileUri: string;
  readonly status: DownloadStatus;
  readonly progress: number;
  readonly bytesTotal: number | null;
  readonly resumeData: string | null;
  readonly error: string | null;
  readonly updatedAt: string;
}

interface DownloadsPayloadV1 {
  readonly version: 1;
  readonly records: readonly DownloadRecord[];
}

const EMPTY: DownloadsPayloadV1 = { version: 1, records: [] };

function isPayload(value: unknown): value is DownloadsPayloadV1 {
  return typeof value === "object" && value !== null && (value as Partial<DownloadsPayloadV1>).version === 1 && Array.isArray((value as Partial<DownloadsPayloadV1>).records);
}

export async function readDownloads(): Promise<readonly DownloadRecord[]> {
  return (await readJson(STORAGE_KEYS.downloads, isPayload, EMPTY)).records;
}

export function writeDownloads(records: readonly DownloadRecord[]): Promise<void> {
  return writeJson(STORAGE_KEYS.downloads, { version: 1, records } satisfies DownloadsPayloadV1);
}
```

```ts
// services/videoActions/downloadService.ts
// MP4-only resumable downloads over expo-file-system/legacy (ADR 0008).
import * as LegacyFs from "expo-file-system/legacy";
import { LIMITS, TIMING } from "../../constants/config";
import { track } from "../analytics";
import { makeError } from "../appError";
import { readDownloads, writeDownloads, type DownloadRecord } from "../storage/downloadsStorage";

type ProgressCallback = (data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void;

export interface Resumable {
  downloadAsync(): Promise<{ uri: string } | undefined>;
  pauseAsync(): Promise<{ resumeData?: string } | undefined>;
  resumeAsync(): Promise<{ uri: string } | undefined>;
  cancelAsync(): Promise<void>;
}

/** Subset of expo-file-system/legacy the service uses; injectable for tests. */
export interface DownloadFs {
  readonly documentDirectory: string | null;
  makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void>;
  getInfoAsync(uri: string): Promise<{ exists: boolean }>;
  deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void>;
  getFreeDiskStorageAsync(): Promise<number>;
  createDownloadResumable(url: string, fileUri: string, options?: { headers?: Record<string, string> }, callback?: ProgressCallback, resumeData?: string): Resumable;
}

export interface DownloadService {
  list(): Promise<readonly DownloadRecord[]>;
  get(videoId: string): Promise<DownloadRecord | null>;
  start(video: { readonly id: string; readonly url: string; readonly kind: "mp4" | "hls"; readonly headers?: Readonly<Record<string, string>> }): Promise<void>;
  pause(videoId: string): Promise<void>;
  resume(videoId: string): Promise<void>;
  cancel(videoId: string): Promise<void>;
  remove(videoId: string): Promise<void>;
  subscribe(listener: (records: readonly DownloadRecord[]) => void): () => void;
  resolveLocalUri(videoId: string): Promise<string | null>;
}

const VIDEOS_DIR = "videos/";

export function createDownloadService(deps: { fs?: DownloadFs; now?: () => string } = {}): DownloadService {
  const fs: DownloadFs = deps.fs ?? (LegacyFs as unknown as DownloadFs);
  const now = deps.now ?? (() => new Date().toISOString());
  const listeners = new Set<(records: readonly DownloadRecord[]) => void>();
  const active = new Map<string, Resumable>();
  const lastProgressWrite = new Map<string, number>();
  let recordsPromise: Promise<DownloadRecord[]> | null = null;

  const dir = () => `${fs.documentDirectory ?? ""}${VIDEOS_DIR}`;
  const fileUriFor = (videoId: string) => `${dir()}${videoId}.mp4`;

  const load = (): Promise<DownloadRecord[]> => {
    if (recordsPromise === null) {
      recordsPromise = readDownloads().then((stored) =>
        // A download interrupted by a restart is resumable, not in flight.
        stored.map((r) => (r.status === "downloading" ? { ...r, status: "paused" as const } : r)),
      );
    }
    return recordsPromise;
  };

  const persist = async (records: DownloadRecord[]): Promise<void> => {
    recordsPromise = Promise.resolve(records);
    await writeDownloads(records);
    for (const l of listeners) l(records);
  };

  const patch = async (videoId: string, changes: Partial<DownloadRecord>): Promise<void> => {
    const records = await load();
    const index = records.findIndex((r) => r.videoId === videoId);
    if (index === -1) return;
    const next = [...records];
    next[index] = { ...records[index], ...changes, updatedAt: now() };
    await persist(next);
  };

  const errorCodeFor = (cause: unknown): string => (cause instanceof Error && /space|ENOSPC/i.test(cause.message) ? "storage_full" : "network");

  const run = async (record: DownloadRecord, resumeData?: string): Promise<void> => {
    const onProgress: ProgressCallback = ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const last = lastProgressWrite.get(record.videoId) ?? 0;
      const at = Date.now();
      if (at - last < TIMING.downloadProgressThrottleMs) return;
      lastProgressWrite.set(record.videoId, at);
      const progress = totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0;
      void patch(record.videoId, { progress, bytesTotal: totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : null });
    };
    const resumable = fs.createDownloadResumable(record.sourceUrl, record.fileUri, {}, onProgress, resumeData);
    active.set(record.videoId, resumable);
    await patch(record.videoId, { status: "downloading", error: null });
    try {
      const result = resumeData ? await resumable.resumeAsync() : await resumable.downloadAsync();
      active.delete(record.videoId);
      if (result === undefined) return; // paused or cancelled
      await patch(record.videoId, { status: "completed", progress: 1, resumeData: null });
      track("download_complete", { videoId: record.videoId });
    } catch (cause) {
      active.delete(record.videoId);
      const code = errorCodeFor(cause);
      await patch(record.videoId, { status: "failed", error: code });
      track("download_fail", { videoId: record.videoId, code });
    }
    await startNextQueued();
  };

  const startNextQueued = async (): Promise<void> => {
    const records = await load();
    if (records.filter((r) => r.status === "downloading").length >= LIMITS.maxConcurrentDownloads) return;
    const next = records.find((r) => r.status === "queued");
    if (next) await run(next);
  };

  return {
    list: () => load(),
    async get(videoId) {
      return (await load()).find((r) => r.videoId === videoId) ?? null;
    },
    async start(video) {
      if (video.kind !== "mp4") throw makeError("validation");
      if ((await fs.getFreeDiskStorageAsync()) < LIMITS.downloadMinFreeBytes) throw makeError("storage_full");
      await fs.makeDirectoryAsync(dir(), { intermediates: true });
      const records = (await load()).filter((r) => r.videoId !== video.id);
      const record: DownloadRecord = {
        videoId: video.id, sourceUrl: video.url, fileUri: fileUriFor(video.id), status: "queued", progress: 0,
        bytesTotal: null, resumeData: null, error: null, updatedAt: now(),
      };
      await persist([...records, record]);
      track("download_start", { videoId: video.id });
      await startNextQueued();
    },
    async pause(videoId) {
      const resumable = active.get(videoId);
      if (!resumable) return;
      const result = await resumable.pauseAsync();
      active.delete(videoId);
      await patch(videoId, { status: "paused", resumeData: result?.resumeData ?? null });
    },
    async resume(videoId) {
      const record = (await load()).find((r) => r.videoId === videoId);
      if (!record || record.status !== "paused") return;
      await run(record, record.resumeData ?? undefined);
    },
    async cancel(videoId) {
      const resumable = active.get(videoId);
      if (resumable) {
        await resumable.cancelAsync();
        active.delete(videoId);
      }
      await fs.deleteAsync(fileUriFor(videoId), { idempotent: true });
      await persist((await load()).filter((r) => r.videoId !== videoId));
      await startNextQueued();
    },
    async remove(videoId) {
      await fs.deleteAsync(fileUriFor(videoId), { idempotent: true });
      await persist((await load()).filter((r) => r.videoId !== videoId));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async resolveLocalUri(videoId) {
      const record = (await load()).find((r) => r.videoId === videoId);
      if (!record || record.status !== "completed") return null;
      return (await fs.getInfoAsync(record.fileUri)).exists ? record.fileUri : null;
    },
  };
}

export const downloadService: DownloadService = createDownloadService();
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern=downloadService` → 6 passed. If `expo-file-system/legacy` fails to import under Jest, add `jest.mock("expo-file-system/legacy", () => ({}))` to the test (the service receives `fs` via deps in every test). If the TypeScript import of `expo-file-system/legacy` fails to resolve, check `node_modules/expo-file-system/package.json` `exports` for the subpath name and record it in the report.

```bash
git add services/storage/downloadsStorage.ts services/videoActions/downloadService.ts __tests__/services/videoActions/downloadService.test.ts
git commit -m "feat(actions): add MP4 download service with persisted registry over expo-file-system/legacy

Verified: npm test -- --testPathPattern=downloadService => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Provider and the rewritten useVideoActions hook

**Files:**
- Create: `components/Video/actions/VideoActionsProvider.tsx`, `components/Video/actions/useVideoActions.ts`
- Test: `__tests__/components/actions/useVideoActions.test.tsx`

**Interfaces:** `docs/player/07-app-actions-and-repositories.md` §3 and §7.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/actions/useVideoActions.test.tsx
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { VideoActionsProvider } from "../../../components/Video/actions/VideoActionsProvider";
import { useVideoActions } from "../../../components/Video/actions/useVideoActions";
import type { VideoActionState, VideoActionsRepository } from "../../../services/videoActions/VideoActionsRepository";
import { makeError } from "../../../services/appError";

function stateOf(videoId: string, o: Partial<VideoActionState> = {}): VideoActionState {
  return { videoId, liked: false, disliked: false, reported: false, notInterested: false, counts: null, updatedAt: "t", ...o };
}

function fakeRepo(): VideoActionsRepository & { resolveLike: (s: VideoActionState) => void; rejectLike: () => void } {
  let pending: { resolve: (s: VideoActionState) => void; reject: (e: unknown) => void } | null = null;
  return {
    getState: jest.fn(async (id: string) => stateOf(id)),
    setLike: jest.fn(() => new Promise<VideoActionState>((resolve, reject) => { pending = { resolve, reject }; })),
    setDislike: jest.fn(async (id: string, v: boolean) => stateOf(id, { disliked: v })),
    report: jest.fn(async (id: string) => stateOf(id, { reported: true })),
    setNotInterested: jest.fn(async (id: string, v: boolean) => stateOf(id, { notInterested: v })),
    setChannelHidden: jest.fn(async () => undefined),
    isChannelHidden: jest.fn(async () => false),
    createClip: jest.fn(async (videoId: string, startMs: number, endMs: number) => ({ id: "c1", videoId, startMs, endMs, createdAt: "t" })),
    listClips: jest.fn(async () => []),
    resolveLike: (s) => pending?.resolve(s),
    rejectLike: () => pending?.reject(makeError("storage")),
  };
}

function wrapper(repository: VideoActionsRepository) {
  return ({ children }: { children: React.ReactNode }) => <VideoActionsProvider deps={{ repository }}>{children}</VideoActionsProvider>;
}

describe("useVideoActions", () => {
  it("loads state on mount", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.state?.videoId).toBe("v1");
  });

  it("like is optimistic, guarded while in flight, and confirmed by the response", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.like());
    expect(result.current.state?.liked).toBe(true);
    expect(result.current.pending.has("like")).toBe(true);
    act(() => result.current.like()); // ignored while pending
    expect(repo.setLike).toHaveBeenCalledTimes(1);
    await act(async () => repo.resolveLike(stateOf("v1", { liked: true })));
    expect(result.current.pending.has("like")).toBe(false);
    expect(result.current.state?.liked).toBe(true);
  });

  it("rollback on failure with an AppError", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.like());
    await act(async () => repo.rejectLike());
    expect(result.current.state?.liked).toBe(false);
    expect(result.current.error?.code).toBe("storage");
  });

  it("dislike clears like optimistically", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.like());
    await act(async () => repo.resolveLike(stateOf("v1", { liked: true })));
    await act(async () => result.current.dislike());
    expect(result.current.state).toMatchObject({ liked: false, disliked: true });
  });

  it("stale load response for a previous videoId is ignored", async () => {
    const repo = fakeRepo();
    let resolveFirst: ((s: VideoActionState) => void) | null = null;
    (repo.getState as jest.Mock).mockImplementationOnce(() => new Promise<VideoActionState>((r) => { resolveFirst = r; }));
    const { result, rerender } = renderHook(({ id }: { id: string }) => useVideoActions(id), { wrapper: wrapper(repo), initialProps: { id: "v1" } });
    rerender({ id: "v2" });
    await waitFor(() => expect(result.current.state?.videoId).toBe("v2"));
    await act(async () => resolveFirst?.(stateOf("v1", { liked: true })));
    expect(result.current.state?.videoId).toBe("v2");
  });

  it("createClip returns the record or null on failure", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await expect(result.current.createClip(1_000, 5_000)).resolves.toMatchObject({ id: "c1" });
    (repo.createClip as jest.Mock).mockRejectedValueOnce(makeError("validation"));
    await expect(result.current.createClip(0, 1)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```tsx
// components/Video/actions/VideoActionsProvider.tsx
import React, { createContext, useContext, useMemo } from "react";
import { downloadService, type DownloadService } from "../../../services/videoActions/downloadService";
import { localVideoActionsRepository } from "../../../services/videoActions/localVideoActionsRepository";
import type { PaymentProvider } from "../../../services/videoActions/PaymentProvider";
import { unavailablePaymentProvider } from "../../../services/videoActions/unavailablePaymentProvider";
import type { VideoActionsRepository } from "../../../services/videoActions/VideoActionsRepository";

export interface VideoActionsDeps {
  readonly repository: VideoActionsRepository;
  readonly downloads: DownloadService;
  readonly payments: PaymentProvider;
}

const DEFAULTS: VideoActionsDeps = { repository: localVideoActionsRepository, downloads: downloadService, payments: unavailablePaymentProvider };

const Context = createContext<VideoActionsDeps>(DEFAULTS);

export function VideoActionsProvider({ children, deps }: { readonly children: React.ReactNode; readonly deps?: Partial<VideoActionsDeps> }) {
  const value = useMemo(() => ({ ...DEFAULTS, ...deps }), [deps]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useVideoActionsDeps(): VideoActionsDeps {
  return useContext(Context);
}
```

```ts
// components/Video/actions/useVideoActions.ts
// Optimistic app actions with rollback, in-flight guard and stale-response protection.
// Spec: docs/player/07-app-actions-and-repositories.md §3
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "../../../services/analytics";
import { toAppError } from "../../../services/appError";
import type { ClipRecord, ReportReason, VideoActionState } from "../../../services/videoActions/VideoActionsRepository";
import type { AppError } from "../../../types/result";
import { useVideoActionsDeps } from "./VideoActionsProvider";

export type PendingAction = "like" | "dislike" | "report" | "notInterested" | "hideChannel" | "clip";

export interface UseVideoActionsResult {
  readonly state: VideoActionState | null;
  readonly status: "loading" | "ready" | "error";
  readonly error: AppError | null;
  readonly pending: ReadonlySet<PendingAction>;
  like(): void;
  dislike(): void;
  report(reason: ReportReason, details?: string): void;
  notInterested(): void;
  hideChannel(channelId: string): void;
  createClip(startMs: number, endMs: number): Promise<ClipRecord | null>;
  retry(): void;
}

export function useVideoActions(videoId: string): UseVideoActionsResult {
  const { repository } = useVideoActionsDeps();
  const [state, setState] = useState<VideoActionState | null>(null);
  const [status, setStatus] = useState<UseVideoActionsResult["status"]>("loading");
  const [error, setError] = useState<AppError | null>(null);
  const [pending, setPending] = useState<ReadonlySet<PendingAction>>(new Set());
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const stateRef = useRef<VideoActionState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    const seq = ++seqRef.current;
    setStatus("loading");
    setError(null);
    repository.getState(videoId).then(
      (loaded) => {
        if (!mountedRef.current || seq !== seqRef.current) return;
        setState(loaded);
        setStatus("ready");
      },
      (cause) => {
        if (!mountedRef.current || seq !== seqRef.current) return;
        setError(toAppError(cause));
        setStatus("error");
      },
    );
  }, [repository, videoId]);

  useEffect(load, [load]);

  const mark = (action: PendingAction, on: boolean) =>
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(action);
      else next.delete(action);
      return next;
    });

  const runOptimistic = useCallback(
    (action: PendingAction, optimistic: Partial<VideoActionState>, call: () => Promise<VideoActionState>, event: "action_like" | "action_dislike" | "action_not_interested" | "report_submit") => {
      const before = stateRef.current;
      if (!before || pending.has(action)) return;
      const seq = ++seqRef.current;
      setState({ ...before, ...optimistic });
      mark(action, true);
      call().then(
        (confirmed) => {
          if (!mountedRef.current) return;
          mark(action, false);
          if (seq === seqRef.current) setState(confirmed);
          track(event, { videoId });
        },
        (cause) => {
          if (!mountedRef.current) return;
          mark(action, false);
          setState(before);
          const appError = toAppError(cause);
          setError(appError);
          track("action_failed", { videoId, code: appError.code });
        },
      );
    },
    [pending, videoId],
  );

  const like = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    runOptimistic("like", { liked: !s.liked, disliked: false }, () => repository.setLike(videoId, !s.liked), "action_like");
  }, [repository, runOptimistic, videoId]);

  const dislike = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    runOptimistic("dislike", { disliked: !s.disliked, liked: false }, () => repository.setDislike(videoId, !s.disliked), "action_dislike");
  }, [repository, runOptimistic, videoId]);

  const report = useCallback(
    (reason: ReportReason, details?: string) => runOptimistic("report", { reported: true }, () => repository.report(videoId, reason, details), "report_submit"),
    [repository, runOptimistic, videoId],
  );

  const notInterested = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    runOptimistic("notInterested", { notInterested: !s.notInterested }, () => repository.setNotInterested(videoId, !s.notInterested), "action_not_interested");
  }, [repository, runOptimistic, videoId]);

  const hideChannel = useCallback(
    (channelId: string) => {
      mark("hideChannel", true);
      repository.setChannelHidden(channelId, true).then(
        () => mountedRef.current && mark("hideChannel", false),
        (cause) => {
          if (!mountedRef.current) return;
          mark("hideChannel", false);
          setError(toAppError(cause));
        },
      );
    },
    [repository],
  );

  const createClip = useCallback(
    async (startMs: number, endMs: number): Promise<ClipRecord | null> => {
      mark("clip", true);
      try {
        const clip = await repository.createClip(videoId, startMs, endMs);
        track("clip_create", { videoId });
        return clip;
      } catch (cause) {
        if (mountedRef.current) setError(toAppError(cause));
        return null;
      } finally {
        if (mountedRef.current) mark("clip", false);
      }
    },
    [repository, videoId],
  );

  return { state, status, error, pending, like, dislike, report, notInterested, hideChannel, createClip, retry: load };
}
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern=components/actions/useVideoActions` → 6 passed.

```bash
git add components/Video/actions/VideoActionsProvider.tsx components/Video/actions/useVideoActions.ts services/analytics.ts __tests__/components/actions/useVideoActions.test.tsx
git commit -m "feat(actions): add VideoActionsProvider and optimistic useVideoActions over the repository

Verified: npm test -- --testPathPattern=components/actions/useVideoActions => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Relocate the action bar, button, Save and Share sheets

**Files:**
- `git mv components/VideoPlayer/VideoActionBar.tsx components/Video/actions/VideoActionBar.tsx`
- `git mv components/VideoPlayer/VideoActionButton.tsx components/Video/actions/VideoActionButton.tsx`
- `git mv components/VideoPlayer/modals/VideoSaveSheet.tsx components/Video/actions/sheets/SaveSheet.tsx`
- `git mv components/VideoPlayer/modals/VideoShareSheet.tsx components/Video/actions/sheets/ShareSheet.tsx`
- `git mv __tests__/player/VideoActionBar.test.tsx __tests__/components/actions/VideoActionBar.test.tsx` (and `VideoSaveSheet.test.tsx` → `SaveSheet.test.tsx`, `VideoShareSheet.test.tsx` → `ShareSheet.test.tsx`)

- [ ] **Step 1: Move with history**

```bash
mkdir -p components/Video/actions/sheets __tests__/components/actions
git mv components/VideoPlayer/VideoActionBar.tsx components/Video/actions/VideoActionBar.tsx
git mv components/VideoPlayer/VideoActionButton.tsx components/Video/actions/VideoActionButton.tsx
git mv components/VideoPlayer/modals/VideoSaveSheet.tsx components/Video/actions/sheets/SaveSheet.tsx
git mv components/VideoPlayer/modals/VideoShareSheet.tsx components/Video/actions/sheets/ShareSheet.tsx
git mv __tests__/player/VideoActionBar.test.tsx __tests__/components/actions/VideoActionBar.test.tsx
git mv __tests__/player/VideoSaveSheet.test.tsx __tests__/components/actions/SaveSheet.test.tsx
git mv __tests__/player/VideoShareSheet.test.tsx __tests__/components/actions/ShareSheet.test.tsx
```

- [ ] **Step 2: Fix imports inside the moved files**

In each moved component, relative imports change depth by one (`../../` → `../../../` for `constants`, `contexts`, `services`, `utils`; `./VideoActionButton` stays for the bar; `../../../contexts/SavedContext` in `SaveSheet.tsx`; `../../../services/shareLinkService` in `ShareSheet.tsx`). Rename the exported components to `SaveSheet` and `ShareSheet` (keep a `export { SaveSheet as VideoSaveSheet }` alias line at the bottom of each so the old root still compiles until Task 10 repoints it). In the moved tests, update the import paths and component names.

- [ ] **Step 3: Run the moved tests and type check**

```bash
npm test -- --testPathPattern="components/actions/(VideoActionBar|SaveSheet|ShareSheet)"
npx tsc --noEmit 2>&1 | grep "components/VideoPlayer/index.tsx"
```
The second command will show errors in the old root (its imports of the moved modals are now broken). That is expected until Task 10; do **not** touch `index.tsx` yet. The moved tests must pass.

- [ ] **Step 4: Commit**

```bash
git add -A components/Video/actions __tests__/components/actions components/VideoPlayer
git commit -m "refactor(actions): relocate action bar, action button, Save and Share sheets to components/Video/actions

Old root imports are repointed in a later commit (Increment 5 Task 10).

Verified: npm test -- --testPathPattern=\"components/actions/(VideoActionBar|SaveSheet|ShareSheet)\" => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: DownloadSheet rewrite over the download service

**Files:**
- `git mv components/VideoPlayer/modals/VideoDownloadModal.tsx components/Video/actions/sheets/DownloadSheet.tsx`, then replace its content
- Test: `__tests__/components/actions/DownloadSheet.test.tsx`

**Interface:** `DownloadSheet({ visible: boolean; onClose: () => void; video: { id: string; url: string; kind: "mp4" | "hls"; title: string }; testID?: string })`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/actions/DownloadSheet.test.tsx
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { VideoActionsProvider } from "../../../components/Video/actions/VideoActionsProvider";
import { DownloadSheet } from "../../../components/Video/actions/sheets/DownloadSheet";
import type { DownloadService } from "../../../services/videoActions/downloadService";
import type { DownloadRecord } from "../../../services/storage/downloadsStorage";
import { makeError } from "../../../services/appError";

function fakeDownloads() {
  let records: DownloadRecord[] = [];
  const listeners = new Set<(r: readonly DownloadRecord[]) => void>();
  const set = (r: DownloadRecord[]) => { records = r; listeners.forEach((l) => l(records)); };
  const service: DownloadService & { set: typeof set } = {
    list: jest.fn(async () => records),
    get: jest.fn(async (id: string) => records.find((r) => r.videoId === id) ?? null),
    start: jest.fn(async () => undefined),
    pause: jest.fn(async () => undefined),
    resume: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    resolveLocalUri: jest.fn(async () => null),
    set,
  };
  return service;
}
const rec = (o: Partial<DownloadRecord>): DownloadRecord => ({ videoId: "v1", sourceUrl: "u", fileUri: "f", status: "queued", progress: 0, bytesTotal: null, resumeData: null, error: null, updatedAt: "t", ...o });
const video = { id: "v1", url: "https://cdn.test/v1.mp4", kind: "mp4" as const, title: "Yagya" };

function renderSheet(downloads: DownloadService, kind: "mp4" | "hls" = "mp4") {
  return render(
    <VideoActionsProvider deps={{ downloads }}>
      <DownloadSheet visible onClose={jest.fn()} video={{ ...video, kind }} testID="dl" />
    </VideoActionsProvider>,
  );
}

describe("DownloadSheet", () => {
  it("not downloaded → Download starts", async () => {
    const d = fakeDownloads();
    renderSheet(d);
    await waitFor(() => expect(screen.getByLabelText("Download")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Download"));
    expect(d.start).toHaveBeenCalledWith({ id: "v1", url: video.url, kind: "mp4" });
  });
  it("downloading → progress, Pause, Cancel", async () => {
    const d = fakeDownloads();
    renderSheet(d);
    act(() => d.set([rec({ status: "downloading", progress: 0.4 })]));
    expect(screen.getByText("40%")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Pause download"));
    fireEvent.press(screen.getByLabelText("Cancel download"));
    expect(d.pause).toHaveBeenCalled();
    expect(d.cancel).toHaveBeenCalled();
  });
  it("paused → Resume; completed → Delete; failed → Retry", async () => {
    const d = fakeDownloads();
    renderSheet(d);
    act(() => d.set([rec({ status: "paused", progress: 0.4 })]));
    fireEvent.press(screen.getByLabelText("Resume download"));
    expect(d.resume).toHaveBeenCalled();
    act(() => d.set([rec({ status: "completed", progress: 1 })]));
    expect(screen.getByText("Downloaded")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Delete download"));
    expect(d.remove).toHaveBeenCalled();
    act(() => d.set([rec({ status: "failed", error: "network" })]));
    fireEvent.press(screen.getByLabelText("Retry download"));
    expect(d.start).toHaveBeenCalled();
  });
  it("storage full shows the safe message", async () => {
    const d = fakeDownloads();
    (d.start as jest.Mock).mockRejectedValueOnce(makeError("storage_full"));
    renderSheet(d);
    await waitFor(() => screen.getByLabelText("Download"));
    await act(async () => fireEvent.press(screen.getByLabelText("Download")));
    expect(screen.getByText("Not enough space on this device to download.")).toBeTruthy();
  });
  it("HLS source renders nothing", () => {
    renderSheet(fakeDownloads(), "hls");
    expect(screen.queryByTestId("dl")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then replace the file content:

```tsx
// components/Video/actions/sheets/DownloadSheet.tsx
// Real MP4 downloads (ADR 0008). States: docs/player/02-feature-catalog.md F33
import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { tokens, getColors } from "../../../../constants/tokens";
import { toAppError } from "../../../../services/appError";
import type { DownloadRecord } from "../../../../services/storage/downloadsStorage";
import type { AppError } from "../../../../types/result";
import { useVideoActionsDeps } from "../VideoActionsProvider";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly video: { readonly id: string; readonly url: string; readonly kind: "mp4" | "hls"; readonly title: string };
  readonly testID?: string;
}

const PERCENT = 100;
const colors = getColors("dark");

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.button}>
      <Text style={styles.buttonText}>{label.replace(/ download$/, "")}</Text>
    </Pressable>
  );
}

export function DownloadSheet({ visible, onClose, video, testID }: Props) {
  const { downloads } = useVideoActionsDeps();
  const [record, setRecord] = useState<DownloadRecord | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    let alive = true;
    downloads.get(video.id).then((r) => alive && setRecord(r));
    const unsubscribe = downloads.subscribe((records) => setRecord(records.find((r) => r.videoId === video.id) ?? null));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [downloads, video.id]);

  const run = useCallback(
    (fn: () => Promise<void>) => {
      setError(null);
      fn().catch((cause) => setError(toAppError(cause)));
    },
    [],
  );

  if (!visible || video.kind !== "mp4") return null;

  const start = () => run(() => downloads.start({ id: video.id, url: video.url, kind: video.kind }));
  const status = record?.status ?? "none";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.title}>{video.title}</Text>
        {status === "none" ? <Button label="Download" onPress={start} /> : null}
        {status === "queued" ? <Text style={styles.text}>Waiting…</Text> : null}
        {status === "downloading" && record ? (
          <>
            <Text style={styles.text}>{`${Math.round(record.progress * PERCENT)}%`}</Text>
            <Button label="Pause download" onPress={() => run(() => downloads.pause(video.id))} />
            <Button label="Cancel download" onPress={() => run(() => downloads.cancel(video.id))} />
          </>
        ) : null}
        {status === "paused" ? (
          <>
            <Button label="Resume download" onPress={() => run(() => downloads.resume(video.id))} />
            <Button label="Cancel download" onPress={() => run(() => downloads.cancel(video.id))} />
          </>
        ) : null}
        {status === "completed" ? (
          <>
            <Text style={styles.text}>Downloaded</Text>
            <Button label="Delete download" onPress={() => run(() => downloads.remove(video.id))} />
          </>
        ) : null}
        {status === "failed" ? (
          <>
            <Text style={styles.text}>Download failed.</Text>
            <Button label="Retry download" onPress={start} />
            <Button label="Delete download" onPress={() => run(() => downloads.cancel(video.id))} />
          </>
        ) : null}
        {error ? <Text style={styles.error}>{error.message}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, padding: tokens.spacing.xl, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg },
  title: { ...tokens.typography.heading, color: colors.text, marginBottom: tokens.spacing.md },
  text: { ...tokens.typography.body, color: colors.text, marginVertical: tokens.spacing.sm },
  error: { ...tokens.typography.body, color: colors.danger, marginTop: tokens.spacing.sm },
  button: { minHeight: tokens.touchTarget.min, justifyContent: "center", paddingHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.sm, borderRadius: tokens.radius.pill, backgroundColor: colors.primary },
  buttonText: { color: colors.onPrimary, fontWeight: "600" },
});
```

- [ ] **Step 3: Run and commit**

```bash
git add -A components/Video/actions/sheets/DownloadSheet.tsx __tests__/components/actions/DownloadSheet.test.tsx
git commit -m "feat(actions): rewrite DownloadSheet over the download service

Verified: npm test -- --testPathPattern=components/actions/DownloadSheet => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: ClipEditor rewire, OverflowMenu trim, ReportSheet, ThanksSheet

**Files:**
- `git mv components/VideoPlayer/modals/VideoClipEditor.tsx components/Video/actions/sheets/ClipEditor.tsx`
- `git mv components/VideoPlayer/modals/VideoOverflowMenu.tsx components/Video/actions/sheets/OverflowMenu.tsx`
- Create: `components/Video/actions/sheets/ReportSheet.tsx`, `components/Video/actions/sheets/ThanksSheet.tsx`
- Test: `__tests__/components/actions/ClipEditor.test.tsx`, `OverflowMenu.test.tsx`, `ReportSheet.test.tsx`, `ThanksSheet.test.tsx`

- [ ] **Step 1: ClipEditor** — keep the existing start/end UI. Change: props become `{ visible, onClose, videoId, durationMs, currentPositionMs, onCreate: (startMs, endMs) => Promise<ClipRecord | null> }`; the save button text is "Save clip"; on success show "Clip saved to this device" then close after `TIMING.undoSnackbarMs`? No — close immediately and let the action bar toast. Validation before calling `onCreate`: `startMs < endMs`, `endMs - startMs` within `LIMITS.clipMinMs..clipMaxMs`, both within `durationMs`; show `makeError("validation").message` otherwise. Test: renders; invalid range shows the validation message and does not call `onCreate`; valid range calls `onCreate(start, end)` and closes.

```tsx
// __tests__/components/actions/ClipEditor.test.tsx (core cases)
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ClipEditor } from "../../../components/Video/actions/sheets/ClipEditor";

it("validates the range and calls onCreate with a valid one", async () => {
  const onCreate = jest.fn().mockResolvedValue({ id: "c1" });
  const onClose = jest.fn();
  render(<ClipEditor visible onClose={onClose} videoId="v1" durationMs={100_000} currentPositionMs={10_000} onCreate={onCreate} />);
  fireEvent.press(screen.getByLabelText("Set start"));       // start = 10_000
  fireEvent.press(screen.getByLabelText("Save clip"));       // end not set → validation
  expect(screen.getByText("That input is not valid.")).toBeTruthy();
  expect(onCreate).not.toHaveBeenCalled();
});
```
Add a second test that re-renders with `currentPositionMs={20_000}`, presses "Set end", then "Save clip", and asserts `onCreate(10_000, 20_000)` and `onClose`. Label the two position buttons "Set start" and "Set end" in the component.

- [ ] **Step 2: OverflowMenu** — remove the Help, Quality and Captions rows and their handlers; keep Not interested, Report (opens `ReportSheet` via an `onReport()` prop), Don't recommend channel. Props: `{ visible, onClose, videoId, channelId?, onNotInterested, onReport, onDontRecommendChannel }`. Test: the three rows exist; removed rows are absent (`queryByText(/Help|Quality|Captions/)` is null); each row calls its callback.

- [ ] **Step 3: ReportSheet**

```tsx
// components/Video/actions/sheets/ReportSheet.tsx
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LIMITS, REPORT_REASONS, type ReportReason } from "../../../../constants/config";
import { getColors, tokens } from "../../../../constants/tokens";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (reason: ReportReason, details?: string) => void;
  readonly testID?: string;
}

const LABELS: Readonly<Record<ReportReason, string>> = { inappropriate: "Inappropriate", spam: "Spam", misleading: "Misleading", other: "Other" };
const colors = getColors("dark");

export function ReportSheet({ visible, onClose, onSubmit, testID }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.title}>Report video</Text>
        {REPORT_REASONS.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} accessibilityLabel={LABELS[r]} style={styles.row}>
            <Text style={styles.text}>{LABELS[r]}</Text>
          </Pressable>
        ))}
        <TextInput value={details} onChangeText={setDetails} maxLength={LIMITS.reportDetailsMaxLength} placeholder="Details (optional)" accessibilityLabel="Details" style={styles.input} />
        <Pressable
          disabled={reason === null}
          onPress={() => reason && onSubmit(reason, details.trim() || undefined)}
          accessibilityRole="button"
          accessibilityLabel="Submit report"
          accessibilityState={{ disabled: reason === null }}
          style={[styles.button, reason === null && styles.disabled]}
        >
          <Text style={styles.buttonText}>Submit</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, padding: tokens.spacing.xl, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg },
  title: { ...tokens.typography.heading, color: colors.text, marginBottom: tokens.spacing.md },
  row: { minHeight: tokens.touchTarget.min, justifyContent: "center" },
  text: { ...tokens.typography.body, color: colors.text },
  input: { marginTop: tokens.spacing.md, padding: tokens.spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: tokens.radius.sm, color: colors.text },
  button: { marginTop: tokens.spacing.lg, minHeight: tokens.touchTarget.min, justifyContent: "center", alignItems: "center", borderRadius: tokens.radius.pill, backgroundColor: colors.primary },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: "600" },
});
```

Test: Submit disabled until a reason is chosen; choosing "Spam" and submitting calls `onSubmit("spam", undefined)`; typing details passes them.

- [ ] **Step 4: ThanksSheet**

```tsx
// components/Video/actions/sheets/ThanksSheet.tsx
// Built against PaymentProvider (ADR 0009). With the unavailable provider it shows "coming soon".
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getColors, tokens } from "../../../../constants/tokens";
import { track } from "../../../../services/analytics";
import { toAppError } from "../../../../services/appError";
import type { PaymentResult, ThanksPreset } from "../../../../services/videoActions/PaymentProvider";
import type { AppError } from "../../../../types/result";
import { useVideoActionsDeps } from "../VideoActionsProvider";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly videoId: string;
  readonly testID?: string;
}

type Phase = { kind: "choose" } | { kind: "processing" } | { kind: "done"; result: PaymentResult } | { kind: "error"; error: AppError };
const colors = getColors("dark");

export function ThanksSheet({ visible, onClose, videoId, testID }: Props) {
  const { payments } = useVideoActionsDeps();
  const [presets, setPresets] = useState<readonly ThanksPreset[]>([]);
  const [selected, setSelected] = useState<ThanksPreset | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });

  useEffect(() => {
    if (!visible) return;
    track("thanks_open", { videoId });
    let alive = true;
    payments.getPresets().then((p) => alive && setPresets(p));
    return () => {
      alive = false;
    };
  }, [payments, videoId, visible]);

  if (!visible) return null;

  const confirm = async () => {
    if (!selected) return;
    setPhase({ kind: "processing" });
    try {
      const intent = await payments.createIntent(videoId, selected.amountMinor, selected.currency);
      setPhase({ kind: "done", result: await payments.confirm(intent.id) });
    } catch (cause) {
      setPhase({ kind: "error", error: toAppError(cause) });
    }
  };

  const canConfirm = payments.isAvailable && selected !== null && phase.kind === "choose";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.title}>Say thanks</Text>
        {!payments.isAvailable ? <Text style={styles.banner}>Thanks is coming soon.</Text> : null}
        <View style={styles.grid}>
          {presets.map((p) => (
            <Pressable key={p.amountMinor} onPress={() => setSelected(p)} accessibilityRole="radio" accessibilityLabel={p.label} accessibilityState={{ checked: selected?.amountMinor === p.amountMinor }} style={[styles.chip, selected?.amountMinor === p.amountMinor && styles.chipSelected]}>
              <Text style={styles.text}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        {phase.kind === "done" ? <Text style={styles.text}>{phase.result.status === "succeeded" ? "Thank you!" : phase.result.status === "cancelled" ? "Cancelled." : "Payment failed."}</Text> : null}
        {phase.kind === "error" ? <Text style={styles.error}>{phase.error.message}</Text> : null}
        <Pressable disabled={!canConfirm} onPress={confirm} accessibilityRole="button" accessibilityLabel="Confirm thanks" accessibilityState={{ disabled: !canConfirm }} style={[styles.button, !canConfirm && styles.disabled]}>
          <Text style={styles.buttonText}>{phase.kind === "processing" ? "Processing…" : "Confirm"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, padding: tokens.spacing.xl, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg },
  title: { ...tokens.typography.heading, color: colors.text, marginBottom: tokens.spacing.md },
  banner: { ...tokens.typography.body, color: colors.textMuted, marginBottom: tokens.spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  chip: { minHeight: tokens.touchTarget.min, justifyContent: "center", paddingHorizontal: tokens.spacing.lg, marginRight: tokens.spacing.sm, marginBottom: tokens.spacing.sm, borderRadius: tokens.radius.pill, backgroundColor: colors.surfaceElevated },
  chipSelected: { backgroundColor: colors.primary },
  text: { ...tokens.typography.body, color: colors.text },
  error: { ...tokens.typography.body, color: colors.danger, marginTop: tokens.spacing.sm },
  button: { marginTop: tokens.spacing.lg, minHeight: tokens.touchTarget.min, justifyContent: "center", alignItems: "center", borderRadius: tokens.radius.pill, backgroundColor: colors.primary },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: "600" },
});
```

Test (`ThanksSheet.test.tsx`): with the default (unavailable) provider — banner shown, presets rendered from `THANKS_PRESETS`, Confirm disabled even after selecting; with a fake available provider (`isAvailable: true`, `createIntent` → `{ id: "i1", … }`, `confirm` → `{ status: "succeeded", receiptId: "r1" }`) — selecting and confirming shows "Thank you!"; with `confirm` → `{ status: "failed", code: "x" }` shows "Payment failed."; `createIntent` rejecting with `makeError("network")` shows the network message.

- [ ] **Step 5: Run all four test files, then commit**

```bash
git add -A components/Video/actions/sheets __tests__/components/actions components/VideoPlayer/modals
git commit -m "feat(actions): wire ClipEditor to the repository, trim OverflowMenu, add ReportSheet and ThanksSheet

Verified: npm test -- --testPathPattern=\"components/actions/(ClipEditor|OverflowMenu|ReportSheet|ThanksSheet)\" => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: VideoActionBar update (Thanks button, HLS hides Download, wired to the new hook)

**Files:**
- Modify: `components/Video/actions/VideoActionBar.tsx`, `__tests__/components/actions/VideoActionBar.test.tsx`

- [ ] **Step 1: Extend the test**

Add cases: Thanks button present only when `PLAYER_FEATURE_FLAGS.thanks` (mock `constants/config` to flip it on in one test); Download hidden when `sourceKind === "hls"` even if the flag is on; pressing Like calls `useVideoActions().like` (mock the hook module and assert).

- [ ] **Step 2: Update the component**

New props: `{ videoId: string; videoTitle: string; videoUrl: string; channelId?: string; sourceKind: "mp4" | "hls" }`. Internally: `const actions = useVideoActions(videoId)`; buttons call `actions.like`, `actions.dislike`; sheet visibility state for Share, Download, Clip, Save, Report, Thanks, More lives here; the bar renders the sheets (`ShareSheet`, `DownloadSheet`, `ClipEditor`, `SaveSheet`, `ReportSheet`, `ThanksSheet`, `OverflowMenu`) below the buttons. Show `actions.error?.message` in a small text line that clears on the next action. Download button: `PLAYER_FEATURE_FLAGS.download && sourceKind === "mp4"`. Thanks button: `PLAYER_FEATURE_FLAGS.thanks`. Counts: shown only when `actions.state?.counts !== null`.

- [ ] **Step 3: Run, commit**

```bash
git add components/Video/actions/VideoActionBar.tsx __tests__/components/actions/VideoActionBar.test.tsx
git commit -m "feat(actions): VideoActionBar owns its sheets, uses the repository hook, adds Thanks and HLS download rule

Verified: npm test -- --testPathPattern=components/actions/VideoActionBar => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Repoint the old root's imports (single permitted edit) and mount the provider

**Files:**
- Modify: `components/VideoPlayer/index.tsx` — import paths only
- Modify: `app/_layout.tsx` — wrap with `VideoActionsProvider`
- Modify: `__tests__/player/invariants.test.ts` — the `OLD_ROOT_FROZEN` check compares against the commit of this task instead of `main` (set `const OLD_ROOT_BASELINE = "<this commit sha>"` and use `git show ${OLD_ROOT_BASELINE}:components/VideoPlayer/index.tsx`); record the sha in the report.

- [ ] **Step 1: Repoint imports in `index.tsx`**

Change only these lines (verify each with `grep -n` first):
```ts
import { VideoActionBar } from "./VideoActionBar";                       → import { VideoActionBar } from "../Video/actions/VideoActionBar";
import { VideoShareSheet } from "./modals/VideoShareSheet";             → import { VideoShareSheet } from "../Video/actions/sheets/ShareSheet";
import { VideoDownloadModal } from "./modals/VideoDownloadModal";       → (remove; the old root's <VideoDownloadModal/> usage is replaced by nothing — the new DownloadSheet is owned by the new bar. Remove the JSX block `<VideoDownloadModal … />` and the `showDownload` state and the `onDownload` handler prop.)
import { VideoClipEditor } from "./modals/VideoClipEditor";             → (same treatment: remove usage; the relocated ClipEditor has a different prop contract)
import { VideoSaveSheet } from "./modals/VideoSaveSheet";               → import { VideoSaveSheet } from "../Video/actions/sheets/SaveSheet";
import { VideoOverflowMenu } from "./modals/VideoOverflowMenu";         → (remove usage; relocated OverflowMenu has a different prop contract)
```
Because the relocated `VideoActionBar` now owns its sheets and takes `{ videoId, videoTitle, videoUrl, channelId, sourceKind }`, replace the old root's `<VideoActionBar …many props… />` block and all five modal blocks with a single:
```tsx
<VideoActionBar videoId={videoId} videoTitle={videoTitle ?? ""} videoUrl={videoUrl || sourceUrl} channelId={channelId} sourceKind={sourceUrl.endsWith(".m3u8") ? "hls" : "mp4"} />
```
and delete the now-unused `useVideoActions` import and call, the `showShare/showDownload/showClip/showSave/showMore` states, and the `hooks/useVideoActions` import. This is more than "import paths" — it is the minimum edit that keeps the old root compiling once the action modules own their sheets. It is still the only edit to `index.tsx` before the swap, it changes no playback behaviour, and it is committed alone.

- [ ] **Step 2: Mount the provider**

In `app/_layout.tsx`, inside `SavedProvider`, wrap `children` with `<VideoActionsProvider>` (import from `@/components/Video/actions/VideoActionsProvider`).

- [ ] **Step 3: Update the frozen-root invariant baseline, run everything**

```bash
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm test -- --testPathPattern=VideoPlayer.render
```
The old characterization tests must still pass (C11/C14 rows: the bar still renders Like/Share/Save; flags still hide Dislike/Download/Clip).

- [ ] **Step 4: Commit**

```bash
git add components/VideoPlayer/index.tsx app/_layout.tsx __tests__/player/invariants.test.ts
git commit -m "refactor(player): repoint old root at relocated action modules; mount VideoActionsProvider

The only edit to the old root before the swap. No playback change.

Verified: npm test -- --testPathPattern=VideoPlayer.render => <N> passed
Verified: npx tsc --noEmit => <N> errors (pre-existing only)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then edit `__tests__/player/invariants.test.ts` `OLD_ROOT_BASELINE` to this commit's sha and commit that one-line change: `test(player): pin frozen-root baseline to <sha>`.

---

### Task 11: Gate and report

`services/videoActionsService.ts` and `hooks/useVideoActions.ts` still exist but nothing imports them now (verify with `grep -rn "videoActionsService\|hooks/useVideoActions" app components hooks services --include=*.ts*`). They are retired in Increment 7, not here, so this increment stays scoped to additions and moves.

- [ ] **Gate**

```bash
npm test 2>&1 | tail -6
npm run test:web 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | grep -c "error TS"
grep -rn "videoActionsService\|hooks/useVideoActions" app components hooks services --include=*.ts --include=*.tsx
```
The grep must print nothing except the two files' own paths.

- [ ] **Report** `docs/superpowers/plans/2026-09-16-video-player-06-report.md`: gate numbers; which `expo-file-system/legacy` functions were used; the frozen-root baseline sha; flags still all `false` (they flip in Increment 7 after the manual matrix); "Not done: `videoActionsService.ts` and `hooks/useVideoActions.ts` left in place for Increment 7 retirement".

- [ ] **Commit the report.** Increment 5 exit criteria: §3.5 tests green; old player still renders (characterization tests green). Merge to `main`.
