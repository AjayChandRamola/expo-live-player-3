// components/VideoPlayer/platform/fullscreen.web.ts
import { fail, ok, reasonOf, type FullscreenAdapter } from "./types";

const hasDocument = (): boolean => typeof document !== "undefined";
const isElement = (value: unknown): value is Element => typeof Element !== "undefined" && value instanceof Element;

export function createFullscreenAdapter(): FullscreenAdapter {
  return {
    async enter(target) {
      if (!hasDocument() || !document.fullscreenEnabled) return fail("unsupported");
      const element = target?.getElement();
      if (!isElement(element)) return fail("no-element");
      try {
        await element.requestFullscreen();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async exit() {
      if (!hasDocument() || document.fullscreenElement === null) return ok;
      try {
        await document.exitFullscreen();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    isActive: () => hasDocument() && document.fullscreenElement !== null,
    subscribe(listener) {
      if (!hasDocument()) return () => undefined;
      const handler = () => listener(document.fullscreenElement !== null);
      document.addEventListener("fullscreenchange", handler);
      return () => document.removeEventListener("fullscreenchange", handler);
    },
  };
}

export const fullscreenAdapter: FullscreenAdapter = createFullscreenAdapter();
