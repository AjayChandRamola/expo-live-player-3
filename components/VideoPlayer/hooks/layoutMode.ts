// components/VideoPlayer/hooks/layoutMode.ts
export type LayoutMode = "inline" | "fullscreen" | "minimized";

export function layoutModeFor(isMinimized: boolean, isFullscreen: boolean): LayoutMode {
  if (isMinimized) return "minimized";
  if (isFullscreen) return "fullscreen";
  return "inline";
}
