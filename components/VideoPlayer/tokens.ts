// components/VideoPlayer/tokens.ts
// Player-only design values. Spacing and radius come from the app tokens.
import { tokens as appTokens } from "../../constants/tokens";

export const playerTokens = {
  color: {
    videoBackground: "#000000",
    onVideo: "#FFFFFF",
    scrim: "rgba(0,0,0,0.35)",
    surface: "rgba(28,28,30,0.92)",
    track: "rgba(255,255,255,0.3)",
    buffered: "rgba(255,255,255,0.5)",
    accent: "#FB923C",
    chapterTick: "rgba(255,255,255,0.85)",
    live: "#E53935",
    captionText: "#FFFFFF",
    captionBackground: "rgba(0,0,0,0.6)",
  },
  size: {
    controlSm: 32,
    controlMd: appTokens.touchTarget.min,
    controlLg: 64,
    thumb: 12,
    progressBar: 3,
    bottomRowHeight: 56,
    swipeIndicatorHeight: 120,
    minTouchTarget: appTokens.touchTarget.min,
  },
  space: appTokens.spacing,
  radius: appTokens.radius,
  opacity: { disabled: 0.4 },
  z: { fullscreen: 1000, overlay: 10, toast: 20, sheet: 30 },
} as const;
