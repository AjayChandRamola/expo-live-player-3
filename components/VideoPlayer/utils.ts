// components/VideoPlayer/utils.ts
/* Small helpers */
export function formatTime(ms?: number | null): string {
  if (ms == null || Number.isNaN(ms)) return "--:--";
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor((total % 3600) / 60);
  const h = Math.floor(total / 3600);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}
