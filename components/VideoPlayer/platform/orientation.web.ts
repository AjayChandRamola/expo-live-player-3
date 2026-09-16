// components/VideoPlayer/platform/orientation.web.ts
import { fail, ok, reasonOf, type OrientationAdapter } from "./types";

type LockableOrientation = { lock?: (mode: "landscape" | "portrait") => Promise<void>; unlock?: () => void };

function orientationApi(): LockableOrientation | null {
  if (typeof window === "undefined" || typeof window.screen === "undefined") return null;
  const value: unknown = window.screen.orientation;
  return typeof value === "object" && value !== null ? (value as LockableOrientation) : null;
}

export function createOrientationAdapter(): OrientationAdapter {
  return {
    async lock(mode) {
      const api = orientationApi();
      if (!api || typeof api.lock !== "function") return fail("unsupported");
      try {
        await api.lock(mode);
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async unlock() {
      const api = orientationApi();
      if (api && typeof api.unlock === "function") api.unlock();
      return ok;
    },
    subscribe(listener) {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
      const query = window.matchMedia("(orientation: portrait)");
      const handler = (event: { matches: boolean }) => listener(event.matches);
      query.addEventListener("change", handler);
      return () => query.removeEventListener("change", handler);
    },
  };
}

export const orientationAdapter: OrientationAdapter = createOrientationAdapter();
