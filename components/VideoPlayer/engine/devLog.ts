// components/VideoPlayer/engine/devLog.ts
// The only logging function in the player. Dev-only, de-duplicated by label.
const seen = new Set<string>();

export function devLog(label: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (seen.has(label)) return;
  seen.add(label);
  if (detail === undefined) console.warn(`[Player] ${label}`);
  else console.warn(`[Player] ${label}`, detail);
}

/** Tests only. */
export function resetDevLogDedupe(): void {
  seen.clear();
}
