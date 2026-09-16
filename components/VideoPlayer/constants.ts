// components/VideoPlayer/constants.ts
// Every timing, threshold, list and message used by the player.
// Docs: docs/player/04-playback-engine-spec.md §7, docs/player/06-ui-and-gestures-spec.md §7
import type { PlaybackErrorCode } from "./engine/types";

// ---- Engine ----
export const TIME_UPDATE_INTERVAL_MS = 250;
export const STALL_TIMEOUT_MS = 2_000;
export const MIN_BUFFER_AHEAD_MS = 500;
export const LOAD_TIMEOUT_MS = 15_000;
export const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
export const MAX_RETRIES = RETRY_DELAYS_MS.length;
export const RESUME_NEAR_END_GUARD_MS = 1_000;
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const DEFAULT_PLAYBACK_RATE = 1;
export const POSITION_REPORT_INTERVAL_MS = 5_000;
/** Seconds passed to seekBy to reach the live edge when duration is unknown; native clamps. */
export const LIVE_EDGE_SEEK_SECONDS = 1_000_000_000;

export const ERROR_MESSAGES: Readonly<Record<PlaybackErrorCode, string>> = {
  network: "Connection problem. Check your network and try again.",
  unsupported: "This video format can't be played on this device.",
  expired: "This video link has expired. Please reopen the video.",
  decode: "Playback problem. Try again.",
  unknown: "Something went wrong. Try again.",
};

/** Ordered: the first code whose needle matches wins. Needles are lower-case. */
export const ERROR_SUBSTRINGS: readonly (readonly [PlaybackErrorCode, readonly string[]])[] = [
  ["expired", ["403", "401", "expired"]],
  ["unsupported", ["unsupported", "codec", "format", "mime"]],
  ["network", ["network", "timed out", "timeout", "connection", "host", "unreachable", "-1009", "-1001", "enotfound"]],
  ["decode", ["decode", "decoder"]],
];

// ---- Layout ----
export const ASPECT_16_9 = 16 / 9;
export const INLINE_MAX_HEIGHT_RATIO = 0.304;
export const MINI_PLAYER_WIDTH = 160;

// ---- Controls visibility ----
export const INITIAL_VISIBLE_MS = 3_000;
export const AUTO_HIDE_MS = 3_500;
export const CONTROLS_FADE_MS = 200;

// ---- Gestures ----
export const DOUBLE_TAP_WINDOW_MS = 300;
export const SKIP_MS = 10_000;
export const SKIP_FEEDBACK_MS = 600;
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_RATE = 2;
export const SWIPE_ACTIVATION_PX = 12;
export const SWIPE_INDICATOR_HIDE_MS = 800;

// ---- Transient UI ----
export const BUFFERING_INDICATOR_DELAY_MS = 300;
export const END_SCREEN_COUNTDOWN_MS = 5_000;
export const TOAST_MS = 1_500;
export const CAPTION_FONT_SIZE = 16;
export const CHAPTER_MARKER_HIT_SLOP = 8;
export const LIVE_EDGE_TOLERANCE_MS = 10_000;

// ---- Keyboard (web) ----
export const KEYBOARD_SEEK_SMALL_MS = 5_000;
export const KEYBOARD_SEEK_LARGE_MS = 10_000;

// ---- Behaviour switches ----
export const FULLSCREEN_ON_ROTATE = true;
