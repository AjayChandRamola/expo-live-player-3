// components/VideoPlayer/platform/systemChrome.web.ts
import { ok, type SystemChromeAdapter } from "./types";

export const systemChromeAdapter: SystemChromeAdapter = {
  hide: async () => ok,
  show: async () => ok,
};
