// components/VideoPlayer/engine/pure/formatTime.ts
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "m:ss" under one hour, "h:mm:ss" otherwise. Negative or NaN → "0:00". */
export function formatTime(ms: number): string {
  const totalSeconds = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / MS_PER_SECOND) : 0;
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  const minutes = Math.floor((totalSeconds % (SECONDS_PER_MINUTE * MINUTES_PER_HOUR)) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${minutes}:${pad2(seconds)}`;
}
