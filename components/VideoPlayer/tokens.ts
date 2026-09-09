
// components/VideoPlayer/tokens.ts
/* Centralized design tokens */
export const TOKENS = {
  accent: "#0ea5ff",
  live: "#e53935",
  dark: {
    background: "#000000",
    overlay: "rgba(0,0,0,0.45)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    controlSurface: "rgba(255,255,255,0.06)",
  },
  light: {
    background: "#f8fafc",
    overlay: "rgba(255,255,255,0.72)",
    text: "#0b1220",
    muted: "rgba(11,18,32,0.78)",
    controlSurface: "rgba(11,18,32,0.06)",
  },
  sizes: {
    controlIcon: 26,
    controlTouch: 48,
    sliderHeight: 6,
    liveBadgeHeight: 22,
    spacing: 8,
  },
  animation: {
    duration: 200,
    hideDelay: 3000,
  },
};
