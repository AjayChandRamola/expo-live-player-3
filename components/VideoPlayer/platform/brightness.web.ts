// components/VideoPlayer/platform/brightness.web.ts
import { clamp } from "../engine/pure/clamp";
import { fail, ok, type BrightnessAdapter, type ElementTarget } from "./types";

export function createBrightnessAdapter(): BrightnessAdapter {
  let target: ElementTarget | null = null;
  let level = 1;
  const element = (): HTMLElement | null => {
    const value = target?.getElement();
    return typeof HTMLElement !== "undefined" && value instanceof HTMLElement ? value : null;
  };
  return {
    attach(next) {
      target = next;
    },
    async get() {
      return level;
    },
    async set(next) {
      const el = element();
      if (!el) return fail("no-element");
      level = clamp(next, 0, 1);
      el.style.filter = `brightness(${level})`;
      return ok;
    },
    async restore() {
      const el = element();
      if (el) el.style.filter = "";
      level = 1;
      return ok;
    },
  };
}

export const brightnessAdapter: BrightnessAdapter = createBrightnessAdapter();
