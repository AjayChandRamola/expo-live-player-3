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
