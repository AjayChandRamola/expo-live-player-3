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
