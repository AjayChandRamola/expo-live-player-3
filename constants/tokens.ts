// constants/tokens.ts
/**
 * The single source of design values for all new UI.
 * No component may hard-code a colour, size, radius, or duration.
 *
 * The existing constants/theme.ts stays for now because components/VideoFeed,
 * components/Shorts, and components/Comments still import it. New code uses
 * this file only.
 */
import type { TextStyle } from "react-native";

export type ColorScheme = "light" | "dark";

export interface Palette {
  readonly primary: string;
  readonly onPrimary: string;
  readonly background: string;
  readonly surface: string;
  readonly surfaceElevated: string;
  readonly text: string;
  readonly textMuted: string;
  readonly border: string;
  readonly overlay: string;
  readonly live: string;
  readonly success: string;
  readonly danger: string;
  readonly skeleton: string;
}

/** Saffron primary, chosen for the Yagna context and legible on both surfaces. */
const LIGHT: Palette = {
  primary: "#C2410C",
  onPrimary: "#FFFFFF",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  surfaceElevated: "#FFFFFF",
  text: "#11181C",
  textMuted: "#5B6670",
  border: "#E2E8F0",
  overlay: "rgba(0,0,0,0.45)",
  live: "#E53935",
  success: "#15803D",
  danger: "#B91C1C",
  skeleton: "#E9EDF2",
};

const DARK: Palette = {
  primary: "#FB923C",
  onPrimary: "#1A1207",
  background: "#0F1113",
  surface: "#16191C",
  surfaceElevated: "#1E2226",
  text: "#ECEDEE",
  textMuted: "#9BA1A6",
  border: "#2A2F35",
  overlay: "rgba(0,0,0,0.6)",
  live: "#FF5A52",
  success: "#4ADE80",
  danger: "#F87171",
  skeleton: "#22272C",
};

export function getColors(scheme: ColorScheme): Palette {
  return scheme === "dark" ? DARK : LIGHT;
}

const typography = {
  title: { fontSize: 24, fontWeight: "600" },
  heading: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400" },
  caption: { fontSize: 12, fontWeight: "400" },
} as const satisfies Record<string, TextStyle>;

export const tokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  iconSize: { sm: 18, md: 24, lg: 28 },
  motion: { fast: 150, normal: 250 },
  /** Accessibility floor. Every pressable must be at least this tall and wide. */
  touchTarget: { min: 44 },
  elevation: {
    level1: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    level2: {
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  },
  typography,
} as const;
