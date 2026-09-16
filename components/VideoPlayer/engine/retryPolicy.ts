// components/VideoPlayer/engine/retryPolicy.ts
import { RETRY_DELAYS_MS } from "../constants";
import type { PlaybackError } from "./types";

/** Delay before retry number `attempt` (zero-based), or null when no retry should happen. */
export function nextRetryDelayMs(attempt: number, error: PlaybackError): number | null {
  if (!error.retryable) return null;
  if (attempt < 0 || attempt >= RETRY_DELAYS_MS.length) return null;
  return RETRY_DELAYS_MS[attempt];
}
