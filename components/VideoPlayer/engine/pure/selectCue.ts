// components/VideoPlayer/engine/pure/selectCue.ts
import type { CaptionItem } from "../../../../types/domain";

const MS_PER_SECOND = 1000;

/**
 * Finds the cue active at positionMs. Cues are in seconds and sorted by start.
 * A cue without `end` lasts until the next cue's start, or forever if last.
 * Binary search on start, then validate the end bound.
 */
export function selectCue(captions: readonly CaptionItem[], positionMs: number): CaptionItem | null {
  if (captions.length === 0) return null;
  let lo = 0;
  let hi = captions.length - 1;
  let index = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (captions[mid].start * MS_PER_SECOND <= positionMs) {
      index = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (index === -1) return null;
  const cue = captions[index];
  if (cue.text.length === 0) return null;
  const next = captions[index + 1];
  const endMs =
    cue.end !== undefined && cue.end !== null
      ? cue.end * MS_PER_SECOND
      : next !== undefined
        ? next.start * MS_PER_SECOND
        : Number.POSITIVE_INFINITY;
  return positionMs < endMs ? cue : null;
}
