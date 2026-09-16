// components/VideoPlayer/platform/brightness.native.ts
// App-window brightness (no permission needed). expo-brightness is imported only here (ADR 0010).
import * as Brightness from "expo-brightness";
import { clamp } from "../engine/pure/clamp";
import { fail, ok, reasonOf, type BrightnessAdapter } from "./types";

export function createBrightnessAdapter(): BrightnessAdapter {
  let initial: number | undefined;
  return {
    attach: () => undefined,
    async get() {
      try {
        const level = await Brightness.getBrightnessAsync();
        if (initial === undefined) initial = level;
        return level;
      } catch {
        return 1;
      }
    },
    async set(level) {
      try {
        await Brightness.setBrightnessAsync(clamp(level, 0, 1));
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async restore() {
      if (initial === undefined) return ok;
      try {
        await Brightness.setBrightnessAsync(initial);
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
  };
}

export const brightnessAdapter: BrightnessAdapter = createBrightnessAdapter();
