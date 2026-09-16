// components/VideoPlayer/platform/fullscreen.native.ts
// Native fullscreen is a layout mode (ADR 0004): this adapter only tracks the flag.
import { ok, type FullscreenAdapter } from "./types";

export function createFullscreenAdapter(): FullscreenAdapter {
  let active = false;
  const listeners = new Set<(active: boolean) => void>();
  const notify = () => {
    for (const listener of listeners) listener(active);
  };
  return {
    async enter() {
      if (!active) {
        active = true;
        notify();
      }
      return ok;
    },
    async exit() {
      if (active) {
        active = false;
        notify();
      }
      return ok;
    },
    isActive: () => active,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const fullscreenAdapter: FullscreenAdapter = createFullscreenAdapter();
