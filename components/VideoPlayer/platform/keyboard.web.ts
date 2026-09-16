// components/VideoPlayer/platform/keyboard.web.ts
// Keyboard map: docs/player/05-platform-adapters-spec.md §3
import type { KeyboardAdapter, PlayerKey } from "./types";

const PLAIN_KEYS: Readonly<Record<string, PlayerKey>> = {
  " ": "togglePlay",
  k: "togglePlay",
  f: "fullscreen",
  m: "mute",
  Escape: "exit",
  ArrowLeft: "seekBack5",
  ArrowRight: "seekForward5",
  j: "seekBack10",
  l: "seekForward10",
  c: "captions",
  "0": "seekPercent0",
  "1": "seekPercent1",
  "2": "seekPercent2",
  "3": "seekPercent3",
  "4": "seekPercent4",
  "5": "seekPercent5",
  "6": "seekPercent6",
  "7": "seekPercent7",
  "8": "seekPercent8",
  "9": "seekPercent9",
};

const SHIFT_KEYS: Readonly<Record<string, PlayerKey>> = {
  "<": "rateDown",
  ">": "rateUp",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

export function mapKeyEvent(event: KeyboardEvent): PlayerKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.shiftKey) return SHIFT_KEYS[event.key] ?? null;
  const single = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return PLAIN_KEYS[single] ?? PLAIN_KEYS[event.key] ?? null;
}

export const keyboardAdapter: KeyboardAdapter = {
  subscribe(handler) {
    if (typeof window === "undefined") return () => undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const mapped = mapKeyEvent(event);
      if (mapped === null) return;
      event.preventDefault();
      handler(mapped);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  },
  subscribeHover(target, onHover) {
    const element = target.getElement();
    if (!(typeof HTMLElement !== "undefined" && element instanceof HTMLElement)) return () => undefined;
    element.addEventListener("mousemove", onHover);
    return () => element.removeEventListener("mousemove", onHover);
  },
};
