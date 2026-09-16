// components/VideoPlayer/engine/pure/clamp.ts
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (min > max) return min;
  return Math.min(max, Math.max(min, value));
}
