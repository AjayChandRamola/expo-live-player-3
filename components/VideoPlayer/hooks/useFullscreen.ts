// components/VideoPlayer/hooks/useFullscreen.ts
// In-place fullscreen orchestration (ADR 0004). Never blocks on a failed adapter.
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { FULLSCREEN_ON_ROTATE } from "../constants";
import { devLog } from "../engine/devLog";
import { fullscreenAdapter, orientationAdapter, systemChromeAdapter, type AdapterResult } from "../platform";

export interface FullscreenInput {
  readonly onChange: (isFullscreen: boolean) => void;
  readonly getElement: () => unknown;
  readonly enabled: boolean;
}

export interface FullscreenController {
  readonly isFullscreen: boolean;
  enter(): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
}

function note(label: string, result: AdapterResult): void {
  if (!result.ok) devLog(`adapter.failed.${label}`, { reason: result.reason });
}

export function useFullscreen({ onChange, getElement, enabled }: FullscreenInput): FullscreenController {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // fullscreenAdapter.exit() fires its own subscribe listeners synchronously
  // (before isFullscreenRef is updated below), so the mirroring effect would
  // otherwise call exit() again reentrantly and recurse forever.
  const exitingRef = useRef(false);

  const apply = useCallback((next: boolean) => {
    if (isFullscreenRef.current === next) return;
    isFullscreenRef.current = next;
    setIsFullscreen(next);
    onChangeRef.current(next);
  }, []);

  const enter = useCallback(async () => {
    if (!enabled || isFullscreenRef.current) return;
    note("fullscreen.enter", await fullscreenAdapter.enter({ getElement }));
    note("orientation.lock", await orientationAdapter.lock("landscape"));
    note("chrome.hide", await systemChromeAdapter.hide());
    apply(true);
  }, [apply, enabled, getElement]);

  const exit = useCallback(async () => {
    if (!isFullscreenRef.current || exitingRef.current) return;
    exitingRef.current = true;
    try {
      note("fullscreen.exit", await fullscreenAdapter.exit());
      note("orientation.lock", await orientationAdapter.lock("portrait"));
      note("chrome.show", await systemChromeAdapter.show());
      apply(false);
    } finally {
      exitingRef.current = false;
    }
  }, [apply]);

  const toggle = useCallback(() => (isFullscreenRef.current ? exit() : enter()), [enter, exit]);

  // Mirror adapter-originated changes (web Escape, browser UI).
  useEffect(
    () =>
      fullscreenAdapter.subscribe((active) => {
        if (!active && isFullscreenRef.current) void exit();
      }),
    [exit],
  );

  // Rotate-to-fullscreen.
  useEffect(() => {
    if (!FULLSCREEN_ON_ROTATE || !enabled) return;
    return orientationAdapter.subscribe((isPortrait) => {
      if (!isPortrait && !isFullscreenRef.current) void enter();
    });
  }, [enabled, enter]);

  // Hardware back while fullscreen.
  useEffect(() => {
    if (!isFullscreen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      void exit();
      return true;
    });
    return () => subscription.remove();
  }, [isFullscreen, exit]);

  // Restore on unmount.
  useEffect(
    () => () => {
      if (isFullscreenRef.current) {
        void orientationAdapter.lock("portrait");
        void systemChromeAdapter.show();
        void fullscreenAdapter.exit();
      }
    },
    [],
  );

  return { isFullscreen, enter, exit, toggle };
}
