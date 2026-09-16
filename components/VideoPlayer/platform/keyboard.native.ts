// components/VideoPlayer/platform/keyboard.native.ts
import type { KeyboardAdapter } from "./types";

const noop = () => undefined;

export const keyboardAdapter: KeyboardAdapter = {
  subscribe: () => noop,
  subscribeHover: () => noop,
};
