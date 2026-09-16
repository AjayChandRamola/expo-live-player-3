# 07 — App Actions and Repositories

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 5.3 |
| ADRs | 0006, 0007, 0008, 0009 |
| Folders | `components/Video/actions/`, `services/videoActions/`, `services/storage/downloadsStorage.ts` |
| Rule | Nothing here is imported by `components/VideoPlayer/`. Everything here may import `contexts/`, `services/`, `hooks/`, `types/`. |

## 1. Relocation map (Increment 5)

| From | To | Change |
|---|---|---|
| `components/VideoPlayer/VideoActionBar.tsx` | `components/Video/actions/VideoActionBar.tsx` | imports fixed; `PLAYER_FEATURE_FLAGS` import unchanged; adds Thanks button (flag) |
| `components/VideoPlayer/VideoActionButton.tsx` | `components/Video/actions/VideoActionButton.tsx` | imports fixed; keeps Reanimated |
| `hooks/useVideoActions.ts` | `components/Video/actions/useVideoActions.ts` | rewritten against the repository (section 3) |
| `components/VideoPlayer/modals/VideoSaveSheet.tsx` | `components/Video/actions/sheets/SaveSheet.tsx` | rename only |
| `components/VideoPlayer/modals/VideoShareSheet.tsx` | `components/Video/actions/sheets/ShareSheet.tsx` | rename only |
| `components/VideoPlayer/modals/VideoDownloadModal.tsx` | `components/Video/actions/sheets/DownloadSheet.tsx` | rewritten against `downloadService` |
| `components/VideoPlayer/modals/VideoClipEditor.tsx` | `components/Video/actions/sheets/ClipEditor.tsx` | wired to `repository.createClip`; copy changed to "Save clip" / "Clip saved to this device" |
| `components/VideoPlayer/modals/VideoOverflowMenu.tsx` | `components/Video/actions/sheets/OverflowMenu.tsx` | Help, Quality, Captions rows removed; Report opens `ReportSheet` |
| (new) | `components/Video/actions/sheets/ReportSheet.tsx` | reasons list, optional details, submit |
| (new) | `components/Video/actions/sheets/ThanksSheet.tsx` | presets, confirm, provider states |
| (new) | `components/Video/actions/VideoActionsProvider.tsx` | injects repository, download service, payment provider |
| `services/videoActionsService.ts` | retired at Increment 7 | replaced by `services/videoActions/*` |
| `__tests__/player/VideoActionBar.test.tsx`, `VideoSaveSheet.test.tsx`, `VideoShareSheet.test.tsx` | `__tests__/components/actions/…` | paths updated, behaviour unchanged |

Use `git mv` so history follows the files.

## 2. Repository interface (`services/videoActions/VideoActionsRepository.ts`)

```ts
export interface VideoActionCounts { readonly likes: number; readonly dislikes: number }

export interface VideoActionState {
  readonly videoId: string;
  readonly liked: boolean;
  readonly disliked: boolean;
  readonly reported: boolean;
  readonly notInterested: boolean;
  readonly counts: VideoActionCounts | null;   // null when the implementation has no counts (local)
  readonly updatedAt: string;                  // ISO 8601
}

export type ReportReason = "inappropriate" | "spam" | "misleading" | "other";

export interface ClipRecord {
  readonly id: string;
  readonly videoId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly createdAt: string;
}

export interface VideoActionsRepository {
  getState(videoId: string): Promise<VideoActionState>;
  setLike(videoId: string, liked: boolean): Promise<VideoActionState>;      // liked=true clears disliked
  setDislike(videoId: string, disliked: boolean): Promise<VideoActionState>; // disliked=true clears liked
  report(videoId: string, reason: ReportReason, details?: string): Promise<VideoActionState>;
  setNotInterested(videoId: string, value: boolean): Promise<VideoActionState>;
  setChannelHidden(channelId: string, hidden: boolean): Promise<void>;
  isChannelHidden(channelId: string): Promise<boolean>;
  createClip(videoId: string, startMs: number, endMs: number): Promise<ClipRecord>;
  listClips(videoId: string): Promise<readonly ClipRecord[]>;
}
```

Contract rules for every implementation:
- **Idempotent:** `setLike(id, true)` when already liked returns the same state and performs no write.
- **Errors:** reject only with `AppError` (`services/appError.ts`); codes: `storage_failed`, `offline`, `unauthorized`, `validation` (`details` > 500 chars, `startMs >= endMs`, etc.).
- **No personal data:** `details` is stored but never logged.
- **Returns the full state** after each write so the hook can replace its optimistic copy in one step.

## 3. Hook (`components/Video/actions/useVideoActions.ts`)

```ts
export interface UseVideoActionsResult {
  readonly state: VideoActionState | null;     // null until first load
  readonly status: "loading" | "ready" | "error";
  readonly error: AppError | null;
  readonly pending: ReadonlySet<"like" | "dislike" | "report" | "notInterested" | "hideChannel" | "clip">;
  like(): void;
  dislike(): void;
  report(reason: ReportReason, details?: string): void;
  notInterested(): void;
  hideChannel(channelId: string): void;
  createClip(startMs: number, endMs: number): Promise<ClipRecord | null>;
  retry(): void;
}
export function useVideoActions(videoId: string): UseVideoActionsResult
```

Rules (each has a test):
1. **Load:** on mount and on `videoId` change, `getState`; stale response protection by a `requestSeq` ref (ignore responses whose seq is not the latest).
2. **Optimistic:** `like()` computes the next state locally (`liked = !liked`, `disliked = false`) and sets it immediately, adds `"like"` to `pending`, then calls `setLike`. On success, replace state with the response **only if** its `seq` is the latest for that action. On failure, restore the pre-action state and set `error` (the bar shows a toast from `error.message`).
3. **In-flight guard:** a second `like()` while `"like"` is pending is ignored.
4. **Mutual exclusion:** like clears dislike optimistically and in the repository; the test asserts both.
5. **Analytics:** `track("action_like", { videoId })` on success; `track("action_like_failed", { videoId, code })` on failure.
6. **Unmount:** no state updates after unmount (`mounted` ref).

## 4. Local repository (`services/videoActions/localVideoActionsRepository.ts`)

Storage through `services/storage/asyncStorageAdapter.ts` (the only module allowed to import AsyncStorage). Key `STORAGE_KEYS.videoActions = "yagna.videoActions.v1"`. Payload:

```ts
interface VideoActionsPayloadV1 {
  readonly version: 1;
  readonly videos: Record<string, Omit<VideoActionState, "videoId" | "counts">>;
  readonly hiddenChannels: readonly string[];
  readonly clips: readonly ClipRecord[];
}
```

Rules: load once and cache in memory; write-through with a `savedWriteDebounceMs`-style debounce (reuse `TIMING.savedWriteDebounceMs` = 300); corrupt or wrong-version payload → reset to empty and `Logger.warn` once; `counts` is always `null`; `createClip` validates `LIMITS.clipMinMs <= endMs - startMs <= LIMITS.clipMaxMs` and generates `id` with `${videoId}:${Date.now()}`.

Tests: round-trip each method; idempotency; corrupt payload reset; debounce coalesces writes; validation errors.

## 5. Download service (`services/videoActions/downloadService.ts`)

### 5.1 Registry (`services/storage/downloadsStorage.ts`)

Key `STORAGE_KEYS.downloads = "yagna.downloads.v1"`.

```ts
export type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "failed";
export interface DownloadRecord {
  readonly videoId: string;
  readonly sourceUrl: string;              // stored without query string in logs; full in storage (needed to resume)
  readonly fileUri: string;                // file://…/videos/<videoId>.mp4
  readonly status: DownloadStatus;
  readonly progress: number;               // 0..1
  readonly bytesTotal: number | null;
  readonly resumeData: string | null;      // from expo-file-system for resume across restarts
  readonly error: string | null;           // AppError code
  readonly updatedAt: string;
}
```

### 5.2 Service API

```ts
export interface DownloadService {
  list(): Promise<readonly DownloadRecord[]>;
  get(videoId: string): Promise<DownloadRecord | null>;
  start(video: { id: string; url: string; kind: "mp4" | "hls" }): Promise<void>;   // kind "hls" → AppError("validation")
  pause(videoId: string): Promise<void>;
  resume(videoId: string): Promise<void>;
  cancel(videoId: string): Promise<void>;   // deletes partial file + record
  remove(videoId: string): Promise<void>;   // deletes completed file + record
  subscribe(listener: (records: readonly DownloadRecord[]) => void): () => void;
  resolveLocalUri(videoId: string): Promise<string | null>;   // fileUri if completed and file exists, else null
}
```

### 5.3 State machine

| From | Action / event | To |
|---|---|---|
| (none) | `start` | `queued` → immediately `downloading` if active count < `LIMITS.maxConcurrentDownloads` |
| `queued` | slot frees | `downloading` |
| `downloading` | progress callback (throttled `TIMING.downloadProgressThrottleMs`) | `downloading` (progress updated) |
| `downloading` | completes | `completed` (progress 1) |
| `downloading` | `pause` | `paused` (`resumeData` saved) |
| `downloading` | error | `failed` (`error` code) |
| `downloading` | app restart (record found in `downloading`) | `paused` |
| `paused` | `resume` | `downloading` |
| `paused`, `failed`, `queued` | `cancel` | removed; partial file deleted |
| `completed` | `remove` | removed; file deleted |
| `failed` | `start` again | `downloading` from scratch |

### 5.4 Implementation notes

- Use the legacy resumable download API, imported from `"expo-file-system/legacy"` (verified on 2026-09-16: `node_modules/expo-file-system/build/legacy/FileSystem.d.ts:166` exports `createDownloadResumable(uri, fileUri, options?, callback?, resumeData?)` with `pauseAsync`/`resumeAsync`/`cancelAsync` and `savable()` for `resumeData`). The new `File`/`Directory` API in the same package has no cross-restart resume, so it is not used for downloads. `documentDirectory`, `makeDirectoryAsync`, `getInfoAsync`, `deleteAsync`, `getFreeDiskStorageAsync` also come from the legacy subpath so the service imports one module. Directory: `${documentDirectory}videos/`, created with `makeDirectoryAsync(intermediates: true)`.
- Free space check before start: if `getFreeDiskStorageAsync()` (or the new API equivalent) is available and `< LIMITS.downloadMinFreeBytes` (200 MB) → `AppError("storage_full")`.
- Only `https://` sources (already guaranteed by the resolver); `headers` from the source are passed to the download.
- Errors map to `AppError` codes: `offline`, `storage_full`, `download_failed`.
- Analytics: `download_start`, `download_complete`, `download_fail` with `{ videoId, code? }`.

### 5.5 Container integration (Increment 6)

`VideoPlaybackContainer` calls `downloadService.resolveLocalUri(video.id)` on mount and on `video.id` change (stale-guarded) and, when non-null, passes `source = { url: localUri, kind: "mp4", isLive: false, posterUrl }`. The `video_start` analytics event includes `{ local: true }`. If the local file fails to play (engine error), the container falls back once to the network source and marks the record `failed` (so the badge disappears).

### 5.6 Sheet (`DownloadSheet.tsx`)

States per F33. Progress ring from `progress`; buttons per state; storage-full message from `AppError.message`. Hidden entirely for `kind === "hls"` (the bar hides the button too).

## 6. Payment provider (`services/videoActions/PaymentProvider.ts`)

```ts
export interface ThanksPreset { readonly amountMinor: number; readonly currency: "INR"; readonly label: string }
export interface PaymentIntent { readonly id: string; readonly amountMinor: number; readonly currency: string }
export type PaymentResult = { readonly status: "succeeded"; readonly receiptId: string } | { readonly status: "cancelled" } | { readonly status: "failed"; readonly code: string };

export interface PaymentProvider {
  readonly isAvailable: boolean;
  getPresets(): Promise<readonly ThanksPreset[]>;
  createIntent(videoId: string, amountMinor: number, currency: string): Promise<PaymentIntent>;
  confirm(intentId: string): Promise<PaymentResult>;
}
```

`unavailablePaymentProvider.ts`: `isAvailable: false`; `getPresets` resolves `THANKS_PRESETS` from `constants/config.ts` (₹51, ₹101, ₹501, ₹1,001 as minor units 5100, 10100, 50100, 100100); `createIntent` and `confirm` reject with `AppError("payments_unavailable")`.

`ThanksSheet.tsx`: presets grid; selected amount; when `!provider.isAvailable` → banner "Thanks is coming soon" and Confirm disabled; when available (future) → Confirm → `createIntent` → `confirm` → result states. Analytics `thanks_open`. Gated by `PLAYER_FEATURE_FLAGS.thanks`.

## 7. Provider (`components/Video/actions/VideoActionsProvider.tsx`)

```ts
interface VideoActionsDeps { repository: VideoActionsRepository; downloads: DownloadService; payments: PaymentProvider }
export function VideoActionsProvider({ children, deps }: { children: ReactNode; deps?: Partial<VideoActionsDeps> })
export function useVideoActionsDeps(): VideoActionsDeps
```

Defaults: `localVideoActionsRepository`, `createDownloadService()`, `unavailablePaymentProvider`. Mounted in `app/_layout.tsx` inside `SavedProvider` (one line). Tests pass fakes through `deps`.

## 8. Backend swap guide (for the future backend increment)

1. Create `services/videoActions/remoteVideoActionsRepository.ts` implementing `VideoActionsRepository` over `services/httpClient.ts` (the only module allowed to call `fetch`). Map HTTP errors to `AppError` codes (`401/403 → unauthorized`, network → `offline`, `4xx → validation`, `5xx → storage_failed`).
2. Return `counts` from the server; the UI shows them automatically.
3. Keep `localVideoActionsRepository` as an offline cache if desired by composing: `cachedRepository(remote, local)`; out of scope here.
4. Change one line in `app/_layout.tsx`: `deps={{ repository: remoteVideoActionsRepository }}`.
5. The hook, sheets, and tests do not change. Add contract tests that run the same test suite against both implementations (`describe.each([local, remoteWithMockedHttp])`).

## 9. Constants added to `constants/config.ts`

```ts
PLAYER_FEATURE_FLAGS: add nothing new (thanks, download, clipEditor, report, dislike, pictureInPicture, qualitySelection already exist)
TIMING.downloadProgressThrottleMs = 500
LIMITS.maxConcurrentDownloads = 1
LIMITS.downloadMinFreeBytes = 200 * 1024 * 1024
LIMITS.clipMinMs = 1_000
LIMITS.clipMaxMs = 60_000
LIMITS.reportDetailsMaxLength = 500
STORAGE_KEYS.videoActions = "yagna.videoActions.v1"
STORAGE_KEYS.downloads = "yagna.downloads.v1"
THANKS_PRESETS = [{ amountMinor: 5100, currency: "INR", label: "₹51" }, …]
REPORT_REASONS: readonly ReportReason[] = ["inappropriate", "spam", "misleading", "other"]
```
