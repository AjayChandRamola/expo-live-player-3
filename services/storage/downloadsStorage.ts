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
