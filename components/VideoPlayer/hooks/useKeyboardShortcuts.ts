// components/VideoPlayer/hooks/useKeyboardShortcuts.ts
// Web keyboard → commands. Native adapter is a no-op, so this hook is inert there.
import { useEffect, useRef } from "react";
import { KEYBOARD_SEEK_LARGE_MS, KEYBOARD_SEEK_SMALL_MS, PLAYBACK_RATES } from "../constants";
import type { PlaybackCommands, PlaybackSnapshot } from "../engine/types";
import { keyboardAdapter, type PlayerKey } from "../platform";
import type { FullscreenController } from "./useFullscreen";

interface Input {
  readonly commands: PlaybackCommands;
  readonly snapshot: PlaybackSnapshot;
  readonly fullscreen: FullscreenController;
  readonly onToggleCaptions: () => void;
  readonly onInteraction: () => void;
  readonly enabled: boolean;
}

const PERCENT_KEYS: readonly PlayerKey[] = [
  "seekPercent0", "seekPercent1", "seekPercent2", "seekPercent3", "seekPercent4",
  "seekPercent5", "seekPercent6", "seekPercent7", "seekPercent8", "seekPercent9",
];
const TENTHS = 10;

function stepRate(current: number, direction: 1 | -1): number {
  const index = (PLAYBACK_RATES as readonly number[]).indexOf(current);
  const next = index === -1 ? PLAYBACK_RATES.indexOf(1) : Math.min(PLAYBACK_RATES.length - 1, Math.max(0, index + direction));
  return PLAYBACK_RATES[next];
}

export function useKeyboardShortcuts(input: Input): void {
  const ref = useRef(input);
  ref.current = input;

  useEffect(() => {
    if (!input.enabled) return;
    return keyboardAdapter.subscribe((key) => {
      const { commands, snapshot, fullscreen, onToggleCaptions, onInteraction } = ref.current;
      onInteraction();
      const percentIndex = PERCENT_KEYS.indexOf(key);
      if (percentIndex !== -1) {
        if (!snapshot.isLive && snapshot.durationMs > 0) commands.seekTo((snapshot.durationMs * percentIndex) / TENTHS);
        return;
      }
      switch (key) {
        case "togglePlay": commands.togglePlay(); return;
        case "fullscreen": void fullscreen.toggle(); return;
        case "exit": void fullscreen.exit(); return;
        case "mute": commands.setMuted(!snapshot.muted); return;
        case "seekBack5": commands.seekBy(-KEYBOARD_SEEK_SMALL_MS); return;
        case "seekForward5": commands.seekBy(KEYBOARD_SEEK_SMALL_MS); return;
        case "seekBack10": commands.seekBy(-KEYBOARD_SEEK_LARGE_MS); return;
        case "seekForward10": commands.seekBy(KEYBOARD_SEEK_LARGE_MS); return;
        case "rateDown": commands.setRate(stepRate(snapshot.playbackRate, -1)); return;
        case "rateUp": commands.setRate(stepRate(snapshot.playbackRate, 1)); return;
        case "captions": onToggleCaptions(); return;
        default: return;
      }
    });
  }, [input.enabled]);
}
