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

  // Patches the record to "downloading" and returns once that is persisted;
  // the actual transfer continues in the background so callers (start/resume/
  // startNextQueued) don't block on the whole download finishing.
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
    const transfer = resumeData ? resumable.resumeAsync() : resumable.downloadAsync();
    transfer.then(
      async (result) => {
        active.delete(record.videoId);
        if (result === undefined) return; // paused or cancelled
        await patch(record.videoId, { status: "completed", progress: 1, resumeData: null });
        track("download_complete", { videoId: record.videoId });
        await startNextQueued();
      },
      async (cause) => {
        active.delete(record.videoId);
        const code = errorCodeFor(cause);
        await patch(record.videoId, { status: "failed", error: code });
        track("download_fail", { videoId: record.videoId, code });
        await startNextQueued();
      },
    );
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
