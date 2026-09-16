# Increment 1 — Playback Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, inline in this session (CLAUDE.md §0 forbids subagents). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-09-16-video-player-00-index.md` first. Increment 0 must be merged (`npm test` and `npm run test:web` run in the main checkout).

**Goal:** Build the headless, event-driven playback engine under `components/VideoPlayer/engine/`, plus the player's constants and tokens, fully unit-tested with a fake expo-video player, without touching the old player.

**Architecture:** A pure reducer owns every status transition (ADR 0002). `PlaybackEngine` subscribes to expo-video events, runs timers for stall, retry and load timeout, validates commands, and publishes immutable snapshots. `usePlaybackEngine` binds it to React with `useSyncExternalStore`, handles `AppState`, and reports position on a cadence.

**Tech Stack:** TypeScript 5.9 strict, expo-video 3.0.11 (types only in tests), Jest 29, RNTL 13 `renderHook`.

**Spec:** `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §4; `docs/player/04-playback-engine-spec.md` (transition table §3, rules E1–E13 §4, fake player §6, constants §7); `docs/player/06-ui-and-gestures-spec.md` §6–§7 (tokens and UI constants, created here so later increments import them).

## Global Constraints

See the index. Additionally:
- Only `engine/PlaybackEngine.ts` and `engine/usePlaybackEngine.ts` import `expo-video`. Activate invariant R3 in Task 15.
- No React import anywhere under `engine/` except `usePlaybackEngine.ts`.
- No `console.*` under `engine/` except inside `devLog.ts`.
- Every timer is created with `setTimeout` and stored so `dispose()` can clear it; `jest.getTimerCount()` must be 0 after dispose in tests.

## File structure produced by this increment

```
components/VideoPlayer/
  constants.ts
  tokens.ts
  types.ts                       (VideoPlayerSource only; VideoPlayerProps arrives in Increment 4)
  engine/
    types.ts
    initialSnapshot.ts
    devLog.ts
    pure/clamp.ts
    pure/formatTime.ts
    pure/selectCue.ts
    pure/currentChapter.ts
    classifyError.ts
    retryPolicy.ts
    playbackReducer.ts
    PlaybackEngine.ts
    usePlaybackEngine.ts
__tests__/player/
  fakes/fakeVideoPlayer.ts
  engine/*.test.ts(x)
  pure/*.test.ts
```

---

### Task 1: Player constants and tokens

**Files:**
- Create: `components/VideoPlayer/constants.ts`
- Create: `components/VideoPlayer/tokens.ts`
- Create: `components/VideoPlayer/engine/types.ts` (needed for `ERROR_MESSAGES` typing; the full file is written here and not changed later)
- Test: `__tests__/player/engine/constants.test.ts`

**Interfaces:**
- Produces: every constant name used by Increments 1–4 (see `docs/player/04-playback-engine-spec.md` §7 and `06-ui-and-gestures-spec.md` §7) and every engine type from spec §4.1 plus the `sourceLoaded` event.

- [ ] **Step 1: Write the failing test**

Create `__tests__/player/engine/constants.test.ts`:

```ts
// __tests__/player/engine/constants.test.ts
import {
  ERROR_MESSAGES,
  ERROR_SUBSTRINGS,
  MAX_RETRIES,
  PLAYBACK_RATES,
  RETRY_DELAYS_MS,
} from "../../../components/VideoPlayer/constants";

describe("player constants", () => {
  it("retry delays are ascending and MAX_RETRIES matches their count", () => {
    expect([...RETRY_DELAYS_MS]).toEqual([1_000, 2_000, 4_000]);
    expect(MAX_RETRIES).toBe(3);
  });

  it("playback rates are ascending and include 1", () => {
    const rates = [...PLAYBACK_RATES];
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(rates).toContain(1);
  });

  it("every error code has a user-safe message without a URL", () => {
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/https?:\/\//);
    }
  });

  it("error substrings are lower-case so matching can lower-case the input once", () => {
    for (const [, needles] of ERROR_SUBSTRINGS) {
      for (const needle of needles) expect(needle).toBe(needle.toLowerCase());
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- --testPathPattern=engine/constants`
Expected: FAIL — `Cannot find module '../../../components/VideoPlayer/constants'`.

- [ ] **Step 3: Create `engine/types.ts`**

Create `components/VideoPlayer/engine/types.ts`:

```ts
// components/VideoPlayer/engine/types.ts
// Shared types for the playback engine, UI and composition root.
// Spec: docs/superpowers/specs/2026-09-16-video-player-redesign-design.md §4.1

export type PlaybackStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error";

export type PlaybackErrorCode = "network" | "unsupported" | "expired" | "decode" | "unknown";

export interface PlaybackError {
  readonly code: PlaybackErrorCode;
  /** User-safe, from ERROR_MESSAGES. Never contains a URL. */
  readonly message: string;
  readonly retryable: boolean;
  /** Raw native message with query strings stripped. Logged only. */
  readonly cause?: string;
}

export interface QualityTrack {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly bitrate: number | null;
  /** "720p", or "Auto" when height is unknown. */
  readonly label: string;
}

export interface SubtitleTrackInfo {
  readonly id: string;
  readonly language: string;
  readonly label: string;
}

export interface PlaybackSnapshot {
  readonly status: PlaybackStatus;
  readonly positionMs: number;
  readonly durationMs: number;
  readonly bufferedMs: number;
  readonly isLive: boolean;
  readonly liveOffsetMs: number | null;
  readonly playbackRate: number;
  readonly muted: boolean;
  readonly volume: number;
  readonly error: PlaybackError | null;
  readonly retryAttempt: number;
  readonly qualities: readonly QualityTrack[];
  readonly activeQuality: QualityTrack | null;
  readonly subtitleTracks: readonly SubtitleTrackInfo[];
  readonly activeSubtitle: SubtitleTrackInfo | null;
  readonly isPictureInPicture: boolean;
  readonly isPlayingBeforeBackground: boolean;
}

export type NativeStatus = "idle" | "loading" | "readyToPlay" | "error";

export type EngineEvent =
  | { readonly type: "sourceSet"; readonly isLive: boolean }
  | { readonly type: "sourceLoaded"; readonly durationMs: number; readonly isLive: boolean }
  | { readonly type: "statusChange"; readonly status: NativeStatus; readonly error?: PlaybackError }
  | { readonly type: "playingChange"; readonly isPlaying: boolean }
  | {
      readonly type: "timeUpdate";
      readonly positionMs: number;
      readonly bufferedMs: number;
      readonly durationMs: number;
      readonly liveOffsetMs: number | null;
    }
  | { readonly type: "playToEnd" }
  | { readonly type: "rateChange"; readonly rate: number }
  | { readonly type: "mutedChange"; readonly muted: boolean }
  | { readonly type: "volumeChange"; readonly volume: number }
  | {
      readonly type: "qualitiesChange";
      readonly qualities: readonly QualityTrack[];
      readonly active: QualityTrack | null;
    }
  | {
      readonly type: "subtitlesChange";
      readonly tracks: readonly SubtitleTrackInfo[];
      readonly active: SubtitleTrackInfo | null;
    }
  | { readonly type: "pipChange"; readonly active: boolean }
  | { readonly type: "stall" }
  | { readonly type: "retryScheduled"; readonly attempt: number }
  | { readonly type: "appBackground" }
  | { readonly type: "appForeground" }
  | { readonly type: "disposed" };

export interface PlaybackCommands {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekTo(positionMs: number): void;
  seekBy(deltaMs: number): void;
  setRate(rate: number): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  /** Not supported by expo-video 3.0.11 (read-only videoTrack). No-op that logs in dev. */
  selectQuality(track: QualityTrack | null): void;
  selectSubtitle(track: SubtitleTrackInfo | null): void;
  goToLive(): void;
  retry(): void;
  replay(): void;
}

export interface EngineOptions {
  readonly autoplay: boolean;
  readonly loop: boolean;
  readonly mutedByDefault: boolean;
  readonly initialPositionMs?: number;
  readonly timeUpdateIntervalMs: number;
}
```

- [ ] **Step 4: Create `components/VideoPlayer/types.ts` (public source type)**

```ts
// components/VideoPlayer/types.ts
// Public types of the player. VideoPlayerProps is added in Increment 4.

export interface VideoPlayerSource {
  /** https:// or file:// (downloaded MP4). Already validated by the app's resolver. */
  readonly url: string;
  readonly kind: "hls" | "mp4";
  /** Declared by the app; the engine also reads the native isLive flag. */
  readonly isLive: boolean;
  readonly posterUrl?: string;
  /** Passed to the native player. Never logged. */
  readonly headers?: Readonly<Record<string, string>>;
}

export type { PlaybackSnapshot, PlaybackStatus, PlaybackError, PlaybackCommands } from "./engine/types";
```

- [ ] **Step 5: Create `constants.ts`**

```ts
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
```

- [ ] **Step 6: Create `tokens.ts`**

```ts
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
```

- [ ] **Step 7: Run the test and the type check**

Run: `npm test -- --testPathPattern=engine/constants`
Expected: 4 passed.

Run: `npx tsc --noEmit 2>&1 | grep "components/VideoPlayer/\(constants\|tokens\|types\|engine\)"`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git checkout -b feature/player-1-engine
git add components/VideoPlayer/constants.ts components/VideoPlayer/tokens.ts components/VideoPlayer/types.ts components/VideoPlayer/engine/types.ts __tests__/player/engine/constants.test.ts
git commit -m "feat(player): add engine types, constants and tokens

Verified: npm test -- --testPathPattern=engine/constants => 4 passed
Verified: npx tsc --noEmit => no errors in components/VideoPlayer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Initial snapshot and devLog

**Files:**
- Create: `components/VideoPlayer/engine/initialSnapshot.ts`
- Create: `components/VideoPlayer/engine/devLog.ts`
- Test: `__tests__/player/engine/initialSnapshot.test.ts`, `__tests__/player/engine/devLog.test.ts`

**Interfaces:**
- Produces: `createInitialSnapshot(overrides?: Partial<PlaybackSnapshot>): PlaybackSnapshot`; `devLog(label: string, detail?: Record<string, unknown>): void`; `resetDevLogDedupe(): void` (tests only).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/player/engine/initialSnapshot.test.ts`:

```ts
// __tests__/player/engine/initialSnapshot.test.ts
import { createInitialSnapshot } from "../../../components/VideoPlayer/engine/initialSnapshot";

describe("createInitialSnapshot", () => {
  it("starts idle with zeroed numbers and nulls", () => {
    const s = createInitialSnapshot();
    expect(s).toEqual({
      status: "idle",
      positionMs: 0,
      durationMs: 0,
      bufferedMs: 0,
      isLive: false,
      liveOffsetMs: null,
      playbackRate: 1,
      muted: false,
      volume: 1,
      error: null,
      retryAttempt: 0,
      qualities: [],
      activeQuality: null,
      subtitleTracks: [],
      activeSubtitle: null,
      isPictureInPicture: false,
      isPlayingBeforeBackground: false,
    });
  });

  it("applies overrides", () => {
    expect(createInitialSnapshot({ status: "playing", positionMs: 5 }).status).toBe("playing");
    expect(createInitialSnapshot({ positionMs: 5 }).positionMs).toBe(5);
  });
});
```

Create `__tests__/player/engine/devLog.test.ts`:

```ts
// __tests__/player/engine/devLog.test.ts
import { devLog, resetDevLogDedupe } from "../../../components/VideoPlayer/engine/devLog";

describe("devLog", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    warn.mockClear();
    resetDevLogDedupe();
  });

  it("logs a label once and de-duplicates repeats", () => {
    devLog("reducer.ignored.idle.timeUpdate");
    devLog("reducer.ignored.idle.timeUpdate");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("reducer.ignored.idle.timeUpdate");
  });

  it("logs different labels separately and includes detail", () => {
    devLog("a", { x: 1 });
    devLog("b");
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][1]).toEqual({ x: 1 });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern="engine/(initialSnapshot|devLog)"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Create `components/VideoPlayer/engine/initialSnapshot.ts`:

```ts
// components/VideoPlayer/engine/initialSnapshot.ts
import { DEFAULT_PLAYBACK_RATE } from "../constants";
import type { PlaybackSnapshot } from "./types";

const INITIAL: PlaybackSnapshot = {
  status: "idle",
  positionMs: 0,
  durationMs: 0,
  bufferedMs: 0,
  isLive: false,
  liveOffsetMs: null,
  playbackRate: DEFAULT_PLAYBACK_RATE,
  muted: false,
  volume: 1,
  error: null,
  retryAttempt: 0,
  qualities: [],
  activeQuality: null,
  subtitleTracks: [],
  activeSubtitle: null,
  isPictureInPicture: false,
  isPlayingBeforeBackground: false,
};

export function createInitialSnapshot(overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot {
  return { ...INITIAL, ...overrides };
}
```

Create `components/VideoPlayer/engine/devLog.ts`:

```ts
// components/VideoPlayer/engine/devLog.ts
// The only logging function in the player. Dev-only, de-duplicated by label.
const seen = new Set<string>();

export function devLog(label: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (seen.has(label)) return;
  seen.add(label);
  if (detail === undefined) console.warn(`[Player] ${label}`);
  else console.warn(`[Player] ${label}`, detail);
}

/** Tests only. */
export function resetDevLogDedupe(): void {
  seen.clear();
}
```

Note: jest-expo defines `__DEV__` as `true` in tests, so the log path is exercised.

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern="engine/(initialSnapshot|devLog)"`
Expected: 4 passed.

```bash
git add components/VideoPlayer/engine/initialSnapshot.ts components/VideoPlayer/engine/devLog.ts __tests__/player/engine/initialSnapshot.test.ts __tests__/player/engine/devLog.test.ts
git commit -m "feat(player): add initial snapshot and dev-only de-duplicated logger

Verified: npm test -- --testPathPattern=\"engine/(initialSnapshot|devLog)\" => 4 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pure helpers — clamp and formatTime

**Files:**
- Create: `components/VideoPlayer/engine/pure/clamp.ts`, `components/VideoPlayer/engine/pure/formatTime.ts`
- Test: `__tests__/player/pure/clamp.test.ts`, `__tests__/player/pure/formatTime.test.ts`

**Interfaces:**
- Produces: `clamp(value: number, min: number, max: number): number`; `formatTime(ms: number): string`.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/pure/clamp.test.ts
import { clamp } from "../../../components/VideoPlayer/engine/pure/clamp";

describe("clamp", () => {
  it("returns the value inside the range", () => expect(clamp(5, 0, 10)).toBe(5));
  it("clamps below", () => expect(clamp(-1, 0, 10)).toBe(0));
  it("clamps above", () => expect(clamp(11, 0, 10)).toBe(10));
  it("treats NaN as min", () => expect(clamp(Number.NaN, 0, 10)).toBe(0));
  it("handles min greater than max by returning min", () => expect(clamp(5, 10, 0)).toBe(10));
});
```

```ts
// __tests__/player/pure/formatTime.test.ts
import { formatTime } from "../../../components/VideoPlayer/engine/pure/formatTime";

describe("formatTime", () => {
  it("formats zero", () => expect(formatTime(0)).toBe("0:00"));
  it("formats seconds with zero padding", () => expect(formatTime(59_000)).toBe("0:59"));
  it("formats minutes", () => expect(formatTime(61_000)).toBe("1:01"));
  it("formats hours with two-digit minutes", () => expect(formatTime(3_600_000 + 5_000)).toBe("1:00:05"));
  it("floors fractional seconds", () => expect(formatTime(1_999)).toBe("0:01"));
  it("treats negative and NaN as zero", () => {
    expect(formatTime(-5_000)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern="pure/(clamp|formatTime)"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/engine/pure/clamp.ts
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (min > max) return min;
  return Math.min(max, Math.max(min, value));
}
```

```ts
// components/VideoPlayer/engine/pure/formatTime.ts
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "m:ss" under one hour, "h:mm:ss" otherwise. Negative or NaN → "0:00". */
export function formatTime(ms: number): string {
  const totalSeconds = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / MS_PER_SECOND) : 0;
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  const minutes = Math.floor((totalSeconds % (SECONDS_PER_MINUTE * MINUTES_PER_HOUR)) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${minutes}:${pad2(seconds)}`;
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern="pure/(clamp|formatTime)"`
Expected: 11 passed.

```bash
git add components/VideoPlayer/engine/pure/clamp.ts components/VideoPlayer/engine/pure/formatTime.ts __tests__/player/pure/clamp.test.ts __tests__/player/pure/formatTime.test.ts
git commit -m "feat(player): add clamp and formatTime pure helpers

Verified: npm test -- --testPathPattern=\"pure/(clamp|formatTime)\" => 11 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Pure helpers — selectCue and currentChapter

**Files:**
- Create: `components/VideoPlayer/engine/pure/selectCue.ts`, `components/VideoPlayer/engine/pure/currentChapter.ts`
- Test: `__tests__/player/pure/selectCue.test.ts`, `__tests__/player/pure/currentChapter.test.ts`

**Interfaces:**
- Consumes: `CaptionItem { start: number; end?: number | null; text: string }` (seconds) and `ChapterItem { title: string; startMs: number }` from `types/domain.ts` (type-only import).
- Produces: `selectCue(captions: readonly CaptionItem[], positionMs: number): CaptionItem | null`; `currentChapter(chapters: readonly ChapterItem[], positionMs: number): ChapterItem | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/pure/selectCue.test.ts
import { selectCue } from "../../../components/VideoPlayer/engine/pure/selectCue";
import type { CaptionItem } from "../../../types/domain";

const cues: readonly CaptionItem[] = [
  { start: 0, end: 2, text: "one" },
  { start: 2, end: 4, text: "two" },
  { start: 6, text: "three" }, // open-ended until next start (none) → until infinity
];

describe("selectCue", () => {
  it("returns null for an empty list", () => expect(selectCue([], 1_000)).toBeNull());
  it("selects the cue containing the position", () => expect(selectCue(cues, 1_000)?.text).toBe("one"));
  it("start boundary is inclusive", () => expect(selectCue(cues, 2_000)?.text).toBe("two"));
  it("end boundary is exclusive", () => expect(selectCue(cues, 4_000)).toBeNull());
  it("returns null in a gap", () => expect(selectCue(cues, 5_000)).toBeNull());
  it("open-ended last cue lasts until the end", () => expect(selectCue(cues, 99_000)?.text).toBe("three"));
  it("open-ended cue ends at the next cue start", () => {
    const list: readonly CaptionItem[] = [{ start: 0, text: "a" }, { start: 3, end: 5, text: "b" }];
    expect(selectCue(list, 2_999)?.text).toBe("a");
    expect(selectCue(list, 3_000)?.text).toBe("b");
  });
  it("skips cues with empty text", () => {
    expect(selectCue([{ start: 0, end: 10, text: "" }], 1_000)).toBeNull();
  });
  it("returns null before the first cue", () => {
    expect(selectCue([{ start: 5, end: 6, text: "x" }], 1_000)).toBeNull();
  });
});
```

```ts
// __tests__/player/pure/currentChapter.test.ts
import { currentChapter } from "../../../components/VideoPlayer/engine/pure/currentChapter";
import type { ChapterItem } from "../../../types/domain";

const chapters: readonly ChapterItem[] = [
  { title: "Intro", startMs: 0 },
  { title: "Mantra", startMs: 60_000 },
  { title: "Aarti", startMs: 180_000 },
];

describe("currentChapter", () => {
  it("returns null for no chapters", () => expect(currentChapter([], 5)).toBeNull());
  it("returns the first chapter at 0", () => expect(currentChapter(chapters, 0)?.title).toBe("Intro"));
  it("returns the chapter whose start is the latest <= position", () => {
    expect(currentChapter(chapters, 59_999)?.title).toBe("Intro");
    expect(currentChapter(chapters, 60_000)?.title).toBe("Mantra");
    expect(currentChapter(chapters, 999_999)?.title).toBe("Aarti");
  });
  it("returns null before the first chapter when it does not start at 0", () => {
    expect(currentChapter([{ title: "Late", startMs: 10_000 }], 5_000)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern="pure/(selectCue|currentChapter)"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/engine/pure/selectCue.ts
import type { CaptionItem } from "../../../../types/domain";

const MS_PER_SECOND = 1000;

/**
 * Finds the cue active at positionMs. Cues are in seconds and sorted by start.
 * A cue without `end` lasts until the next cue's start, or forever if last.
 * Binary search on start, then validate the end bound.
 */
export function selectCue(captions: readonly CaptionItem[], positionMs: number): CaptionItem | null {
  if (captions.length === 0) return null;
  let lo = 0;
  let hi = captions.length - 1;
  let index = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (captions[mid].start * MS_PER_SECOND <= positionMs) {
      index = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (index === -1) return null;
  const cue = captions[index];
  if (cue.text.length === 0) return null;
  const next = captions[index + 1];
  const endMs =
    cue.end !== undefined && cue.end !== null
      ? cue.end * MS_PER_SECOND
      : next !== undefined
        ? next.start * MS_PER_SECOND
        : Number.POSITIVE_INFINITY;
  return positionMs < endMs ? cue : null;
}
```

```ts
// components/VideoPlayer/engine/pure/currentChapter.ts
import type { ChapterItem } from "../../../../types/domain";

/** The chapter with the greatest startMs <= positionMs, or null. Chapters are sorted by startMs. */
export function currentChapter(chapters: readonly ChapterItem[], positionMs: number): ChapterItem | null {
  let found: ChapterItem | null = null;
  for (const chapter of chapters) {
    if (chapter.startMs <= positionMs) found = chapter;
    else break;
  }
  return found;
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern="pure/(selectCue|currentChapter)"`
Expected: 13 passed.

```bash
git add components/VideoPlayer/engine/pure/selectCue.ts components/VideoPlayer/engine/pure/currentChapter.ts __tests__/player/pure/selectCue.test.ts __tests__/player/pure/currentChapter.test.ts
git commit -m "feat(player): add caption cue and chapter lookup helpers

Verified: npm test -- --testPathPattern=\"pure/(selectCue|currentChapter)\" => 13 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: classifyError and retryPolicy

**Files:**
- Create: `components/VideoPlayer/engine/classifyError.ts`, `components/VideoPlayer/engine/retryPolicy.ts`
- Test: `__tests__/player/engine/classifyError.test.ts`, `__tests__/player/engine/retryPolicy.test.ts`

**Interfaces:**
- Produces: `classifyError(nativeMessage: string | undefined): PlaybackError`; `stripQuery(text: string): string`; `nextRetryDelayMs(attempt: number, error: PlaybackError): number | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/engine/classifyError.test.ts
import { classifyError, stripQuery } from "../../../components/VideoPlayer/engine/classifyError";
import { ERROR_MESSAGES } from "../../../components/VideoPlayer/constants";

describe("classifyError", () => {
  it.each([
    ["HTTP 403 Forbidden", "expired"],
    ["Token expired for asset", "expired"],
    ["Unsupported codec avc3", "unsupported"],
    ["Unknown MIME type", "unsupported"],
    ["Network timed out", "network"],
    ["Could not connect to host", "network"],
    ["NSURLErrorDomain -1009", "network"],
    ["Decoder init failed", "decode"],
    ["Something odd", "unknown"],
  ] as const)("maps %p to %p", (message, code) => {
    const error = classifyError(message);
    expect(error.code).toBe(code);
    expect(error.message).toBe(ERROR_MESSAGES[code]);
  });

  it("is case-insensitive", () => expect(classifyError("NETWORK ERROR").code).toBe("network"));
  it("undefined message → unknown, retryable", () => {
    const error = classifyError(undefined);
    expect(error.code).toBe("unknown");
    expect(error.retryable).toBe(true);
    expect(error.cause).toBeUndefined();
  });
  it("unsupported is not retryable; others are", () => {
    expect(classifyError("unsupported").retryable).toBe(false);
    expect(classifyError("403").retryable).toBe(true);
  });
  it("first matching code in order wins (403 before network)", () => {
    expect(classifyError("network 403").code).toBe("expired");
  });
  it("strips query strings from the cause", () => {
    expect(classifyError("Failed https://cdn.test/v.mp4?token=abc now").cause).toBe("Failed https://cdn.test/v.mp4 now");
  });
});

describe("stripQuery", () => {
  it("removes ?… up to whitespace or end", () => {
    expect(stripQuery("a?b=1")).toBe("a");
    expect(stripQuery("x https://h/p?q=1&r=2 y")).toBe("x https://h/p y");
    expect(stripQuery("no query")).toBe("no query");
  });
});
```

```ts
// __tests__/player/engine/retryPolicy.test.ts
import { nextRetryDelayMs } from "../../../components/VideoPlayer/engine/retryPolicy";
import type { PlaybackError } from "../../../components/VideoPlayer/engine/types";

const retryable: PlaybackError = { code: "network", message: "m", retryable: true };
const fatal: PlaybackError = { code: "unsupported", message: "m", retryable: false };

describe("nextRetryDelayMs", () => {
  it("returns 1s, 2s, 4s for attempts 0, 1, 2", () => {
    expect(nextRetryDelayMs(0, retryable)).toBe(1_000);
    expect(nextRetryDelayMs(1, retryable)).toBe(2_000);
    expect(nextRetryDelayMs(2, retryable)).toBe(4_000);
  });
  it("returns null after the last attempt", () => expect(nextRetryDelayMs(3, retryable)).toBeNull());
  it("returns null for non-retryable errors", () => expect(nextRetryDelayMs(0, fatal)).toBeNull());
  it("returns null for negative attempts", () => expect(nextRetryDelayMs(-1, retryable)).toBeNull());
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern="engine/(classifyError|retryPolicy)"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/engine/classifyError.ts
import { ERROR_MESSAGES, ERROR_SUBSTRINGS } from "../constants";
import type { PlaybackError, PlaybackErrorCode } from "./types";

const QUERY_STRING = /\?[^\s]*/g;

/** Removes "?..." segments so URLs with tokens never reach a log. */
export function stripQuery(text: string): string {
  return text.replace(QUERY_STRING, "");
}

function codeFor(message: string): PlaybackErrorCode {
  const lower = message.toLowerCase();
  for (const [code, needles] of ERROR_SUBSTRINGS) {
    if (needles.some((needle) => lower.includes(needle))) return code;
  }
  return "unknown";
}

export function classifyError(nativeMessage: string | undefined): PlaybackError {
  const code = nativeMessage === undefined ? "unknown" : codeFor(nativeMessage);
  return {
    code,
    message: ERROR_MESSAGES[code],
    retryable: code !== "unsupported",
    cause: nativeMessage === undefined ? undefined : stripQuery(nativeMessage),
  };
}
```

```ts
// components/VideoPlayer/engine/retryPolicy.ts
import { RETRY_DELAYS_MS } from "../constants";
import type { PlaybackError } from "./types";

/** Delay before retry number `attempt` (zero-based), or null when no retry should happen. */
export function nextRetryDelayMs(attempt: number, error: PlaybackError): number | null {
  if (!error.retryable) return null;
  if (attempt < 0 || attempt >= RETRY_DELAYS_MS.length) return null;
  return RETRY_DELAYS_MS[attempt];
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern="engine/(classifyError|retryPolicy)"`
Expected: 19 passed.

```bash
git add components/VideoPlayer/engine/classifyError.ts components/VideoPlayer/engine/retryPolicy.ts __tests__/player/engine/classifyError.test.ts __tests__/player/engine/retryPolicy.test.ts
git commit -m "feat(player): add error classification and retry policy

Verified: npm test -- --testPathPattern=\"engine/(classifyError|retryPolicy)\" => 19 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: playbackReducer — status and playing transitions

**Files:**
- Create: `components/VideoPlayer/engine/playbackReducer.ts`
- Test: `__tests__/player/engine/playbackReducer.test.ts`

**Interfaces:**
- Produces: `playbackReducer(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot`. Task 7 extends the same file and test.

- [ ] **Step 1: Write the failing test (part A of the transition table)**

Create `__tests__/player/engine/playbackReducer.test.ts`:

```ts
// __tests__/player/engine/playbackReducer.test.ts
// Normative transition table: docs/player/04-playback-engine-spec.md §3.
import { playbackReducer } from "../../../components/VideoPlayer/engine/playbackReducer";
import { createInitialSnapshot } from "../../../components/VideoPlayer/engine/initialSnapshot";
import { resetDevLogDedupe } from "../../../components/VideoPlayer/engine/devLog";
import type {
  EngineEvent,
  PlaybackError,
  PlaybackSnapshot,
  PlaybackStatus,
} from "../../../components/VideoPlayer/engine/types";

const ALL_STATUSES: readonly PlaybackStatus[] = ["idle", "loading", "ready", "playing", "paused", "buffering", "ended", "error"];
const NET_ERROR: PlaybackError = { code: "network", message: "net", retryable: true };

function at(status: PlaybackStatus, overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot {
  const base: Partial<PlaybackSnapshot> = status === "error" ? { error: NET_ERROR } : {};
  return createInitialSnapshot({ status, ...base, ...overrides });
}

const sourceSet: EngineEvent = { type: "sourceSet", isLive: false };
const loading: EngineEvent = { type: "statusChange", status: "loading" };
const ready: EngineEvent = { type: "statusChange", status: "readyToPlay" };
const nativeError: EngineEvent = { type: "statusChange", status: "error", error: NET_ERROR };
const playing: EngineEvent = { type: "playingChange", isPlaying: true };
const notPlaying: EngineEvent = { type: "playingChange", isPlaying: false };
const disposed: EngineEvent = { type: "disposed" };

/** [from, event, expected status, "ignored" when the reducer must return prev by reference] */
type Row = readonly [PlaybackStatus, EngineEvent, PlaybackStatus | "ignored", string];

const PART_A: readonly Row[] = [
  // sourceSet
  ["idle", sourceSet, "loading", "idle + sourceSet"],
  ["loading", sourceSet, "loading", "loading + sourceSet"],
  ["ready", sourceSet, "loading", "ready + sourceSet"],
  ["playing", sourceSet, "loading", "playing + sourceSet"],
  ["paused", sourceSet, "loading", "paused + sourceSet"],
  ["buffering", sourceSet, "loading", "buffering + sourceSet"],
  ["ended", sourceSet, "loading", "ended + sourceSet"],
  ["error", sourceSet, "loading", "error + sourceSet"],
  // statusChange loading
  ["idle", loading, "loading", "idle + loading"],
  ["loading", loading, "ignored", "loading + loading"],
  ["ready", loading, "ignored", "ready + loading"],
  ["playing", loading, "buffering", "playing + loading"],
  ["paused", loading, "ignored", "paused + loading"],
  ["buffering", loading, "ignored", "buffering + loading"],
  ["ended", loading, "ignored", "ended + loading"],
  ["error", loading, "loading", "error + loading (retry)"],
  // statusChange readyToPlay
  ["idle", ready, "ignored", "idle + ready"],
  ["loading", ready, "ready", "loading + ready"],
  ["ready", ready, "ignored", "ready + ready"],
  ["playing", ready, "ignored", "playing + ready"],
  ["paused", ready, "ignored", "paused + ready"],
  ["buffering", ready, "buffering", "buffering + ready (stay)"],
  ["ended", ready, "ignored", "ended + ready"],
  ["error", ready, "ignored", "error + ready"],
  // statusChange error
  ...ALL_STATUSES.map((s): Row => [s, nativeError, "error", `${s} + error`]),
  // playingChange true
  ["idle", playing, "ignored", "idle + playing"],
  ["loading", playing, "playing", "loading + playing"],
  ["ready", playing, "playing", "ready + playing"],
  ["playing", playing, "playing", "playing + playing (stay)"],
  ["paused", playing, "playing", "paused + playing"],
  ["buffering", playing, "playing", "buffering + playing"],
  ["ended", playing, "playing", "ended + playing (replay)"],
  ["error", playing, "ignored", "error + playing"],
  // playingChange false
  ["idle", notPlaying, "ignored", "idle + notPlaying"],
  ["loading", notPlaying, "ignored", "loading + notPlaying"],
  ["ready", notPlaying, "ignored", "ready + notPlaying"],
  ["playing", notPlaying, "paused", "playing + notPlaying"],
  ["paused", notPlaying, "paused", "paused + notPlaying (stay)"],
  ["buffering", notPlaying, "paused", "buffering + notPlaying"],
  ["ended", notPlaying, "ignored", "ended + notPlaying"],
  ["error", notPlaying, "ignored", "error + notPlaying"],
  // disposed
  ...ALL_STATUSES.map((s): Row => [s, disposed, "idle", `${s} + disposed`]),
];

describe("playbackReducer part A: source, status, playing, disposed", () => {
  beforeEach(() => resetDevLogDedupe());

  it.each(PART_A)("%s + %o → %s (%s)", (from, event, expected) => {
    const prev = at(from);
    const next = playbackReducer(prev, event);
    if (expected === "ignored") {
      expect(next).toBe(prev);
    } else {
      expect(next.status).toBe(expected);
    }
  });

  it("sourceSet resets position, duration, buffered, error, retryAttempt, rate and sets isLive", () => {
    const prev = at("error", { positionMs: 50, durationMs: 100, bufferedMs: 60, retryAttempt: 2, playbackRate: 2, qualities: [{ id: "1", width: 1, height: 1, bitrate: null, label: "1p" }] });
    const next = playbackReducer(prev, { type: "sourceSet", isLive: true });
    expect(next).toMatchObject({ status: "loading", positionMs: 0, durationMs: 0, bufferedMs: 0, error: null, retryAttempt: 0, playbackRate: 1, isLive: true, qualities: [], activeQuality: null });
    // muted and volume survive a source change
    const muted = playbackReducer(at("paused", { muted: true, volume: 0.3 }), sourceSet);
    expect(muted.muted).toBe(true);
    expect(muted.volume).toBe(0.3);
  });

  it("entering error stores the error; leaving error via loading clears it and keeps retryAttempt", () => {
    const errored = playbackReducer(at("playing"), nativeError);
    expect(errored.error).toEqual(NET_ERROR);
    const retrying = playbackReducer({ ...errored, retryAttempt: 2 }, loading);
    expect(retrying.status).toBe("loading");
    expect(retrying.error).toBeNull();
    expect(retrying.retryAttempt).toBe(2);
  });

  it("error without payload falls back to an unknown, retryable error", () => {
    const next = playbackReducer(at("playing"), { type: "statusChange", status: "error" });
    expect(next.error?.code).toBe("unknown");
    expect(next.error?.retryable).toBe(true);
  });

  it("disposed clears the error", () => {
    expect(playbackReducer(at("error"), disposed).error).toBeNull();
  });

  it("native idle status is ignored", () => {
    const prev = at("playing");
    expect(playbackReducer(prev, { type: "statusChange", status: "idle" })).toBe(prev);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern=engine/playbackReducer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement part A**

Create `components/VideoPlayer/engine/playbackReducer.ts`:

```ts
// components/VideoPlayer/engine/playbackReducer.ts
// Pure status machine. Table: docs/player/04-playback-engine-spec.md §3.
// Ignored (state, event) pairs return `prev` by reference and log once in dev.
import { DEFAULT_PLAYBACK_RATE, ERROR_MESSAGES, MAX_RETRIES, MIN_BUFFER_AHEAD_MS } from "../constants";
import { devLog } from "./devLog";
import { clamp } from "./pure/clamp";
import type { EngineEvent, PlaybackError, PlaybackSnapshot, PlaybackStatus } from "./types";

type StatusChangeEvent = Extract<EngineEvent, { type: "statusChange" }>;
type TimeUpdateEvent = Extract<EngineEvent, { type: "timeUpdate" }>;

const UNKNOWN_ERROR: PlaybackError = { code: "unknown", message: ERROR_MESSAGES.unknown, retryable: true };

const SOURCE_RESET: Partial<PlaybackSnapshot> = {
  positionMs: 0,
  durationMs: 0,
  bufferedMs: 0,
  liveOffsetMs: null,
  playbackRate: DEFAULT_PLAYBACK_RATE,
  error: null,
  retryAttempt: 0,
  qualities: [],
  activeQuality: null,
  subtitleTracks: [],
  activeSubtitle: null,
  isPlayingBeforeBackground: false,
};

const CAN_END: readonly PlaybackStatus[] = ["ready", "playing", "paused", "buffering"];
const RECEIVES_TIME: readonly PlaybackStatus[] = ["loading", "ready", "playing", "paused", "buffering"];

function ignored(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot {
  devLog(`reducer.ignored.${prev.status}.${event.type}`);
  return prev;
}

/** Returns prev when every listed field is already equal (reference equality for arrays/objects). */
function withChanges(prev: PlaybackSnapshot, changes: Partial<PlaybackSnapshot>): PlaybackSnapshot {
  for (const key of Object.keys(changes) as (keyof PlaybackSnapshot)[]) {
    if (prev[key] !== changes[key]) return { ...prev, ...changes };
  }
  return prev;
}

function clampPosition(positionMs: number, durationMs: number): number {
  const rounded = Math.round(Number.isFinite(positionMs) ? positionMs : 0);
  return durationMs > 0 ? clamp(rounded, 0, durationMs) : Math.max(0, rounded);
}

function onStatusChange(prev: PlaybackSnapshot, event: StatusChangeEvent): PlaybackSnapshot {
  switch (event.status) {
    case "error":
      return { ...prev, status: "error", error: event.error ?? UNKNOWN_ERROR };
    case "loading":
      if (prev.status === "idle") return { ...prev, status: "loading" };
      if (prev.status === "playing") return { ...prev, status: "buffering" };
      if (prev.status === "error") return { ...prev, status: "loading", error: null };
      return ignored(prev, event);
    case "readyToPlay":
      if (prev.status === "loading") return { ...prev, status: "ready" };
      if (prev.status === "buffering") return prev;
      return ignored(prev, event);
    case "idle":
      return ignored(prev, event);
  }
}

function onPlayingChange(prev: PlaybackSnapshot, event: Extract<EngineEvent, { type: "playingChange" }>): PlaybackSnapshot {
  if (event.isPlaying) {
    switch (prev.status) {
      case "loading":
      case "ready":
      case "paused":
      case "buffering":
      case "ended":
        return { ...prev, status: "playing" };
      case "playing":
        return prev;
      default:
        return ignored(prev, event);
    }
  }
  switch (prev.status) {
    case "playing":
    case "buffering":
      return { ...prev, status: "paused" };
    case "paused":
      return prev;
    default:
      return ignored(prev, event);
  }
}

function onTimeUpdate(prev: PlaybackSnapshot, event: TimeUpdateEvent): PlaybackSnapshot {
  if (prev.status === "ended") {
    return withChanges(prev, { positionMs: clampPosition(event.positionMs, prev.durationMs) });
  }
  if (!RECEIVES_TIME.includes(prev.status)) return ignored(prev, event);
  const durationMs = event.durationMs > 0 ? Math.round(event.durationMs) : prev.durationMs;
  const positionMs = clampPosition(event.positionMs, durationMs);
  const bufferedMs = Math.max(0, Math.round(event.bufferedMs));
  const next = withChanges(prev, {
    positionMs,
    durationMs,
    bufferedMs,
    liveOffsetMs: prev.isLive ? event.liveOffsetMs : null,
  });
  if (next.status === "buffering" && bufferedMs > positionMs + MIN_BUFFER_AHEAD_MS) {
    return { ...next, status: "playing" };
  }
  return next;
}

function onAppBackground(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot {
  switch (prev.status) {
    case "playing":
    case "buffering":
      return { ...prev, status: "paused", isPlayingBeforeBackground: true };
    case "loading":
    case "ready":
    case "paused":
      return withChanges(prev, { isPlayingBeforeBackground: false });
    case "ended":
    case "error":
      return prev;
    case "idle":
      return ignored(prev, event);
  }
}

export function playbackReducer(prev: PlaybackSnapshot, event: EngineEvent): PlaybackSnapshot {
  switch (event.type) {
    case "sourceSet":
      return { ...prev, ...SOURCE_RESET, status: "loading", isLive: event.isLive };
    case "disposed":
      return prev.status === "idle" && prev.error === null ? prev : { ...prev, status: "idle", error: null };
    case "statusChange":
      return onStatusChange(prev, event);
    case "sourceLoaded":
      return prev.status === "idle"
        ? ignored(prev, event)
        : withChanges(prev, {
            durationMs: event.durationMs > 0 ? Math.round(event.durationMs) : prev.durationMs,
            isLive: prev.isLive || event.isLive,
          });
    case "playingChange":
      return onPlayingChange(prev, event);
    case "timeUpdate":
      return onTimeUpdate(prev, event);
    case "playToEnd":
      return CAN_END.includes(prev.status) ? { ...prev, status: "ended" } : ignored(prev, event);
    case "stall":
      return prev.status === "playing" ? { ...prev, status: "buffering" } : ignored(prev, event);
    case "appBackground":
      return onAppBackground(prev, event);
    case "appForeground":
      return prev.status === "idle" ? ignored(prev, event) : prev;
    case "rateChange":
      return prev.status === "idle" ? ignored(prev, event) : withChanges(prev, { playbackRate: event.rate });
    case "mutedChange":
      return prev.status === "idle" ? ignored(prev, event) : withChanges(prev, { muted: event.muted });
    case "volumeChange":
      return prev.status === "idle" ? ignored(prev, event) : withChanges(prev, { volume: clamp(event.volume, 0, 1) });
    case "qualitiesChange":
      return prev.status === "idle"
        ? ignored(prev, event)
        : withChanges(prev, { qualities: event.qualities, activeQuality: event.active });
    case "subtitlesChange":
      return prev.status === "idle"
        ? ignored(prev, event)
        : withChanges(prev, { subtitleTracks: event.tracks, activeSubtitle: event.active });
    case "pipChange":
      return prev.status === "idle" ? ignored(prev, event) : withChanges(prev, { isPictureInPicture: event.active });
    case "retryScheduled":
      return prev.status !== "error"
        ? ignored(prev, event)
        : withChanges(prev, { retryAttempt: Math.min(event.attempt, MAX_RETRIES) });
  }
}
```

- [ ] **Step 4: Run part A**

Run: `npm test -- --testPathPattern=engine/playbackReducer`
Expected: all part A rows pass (≈ 70 tests).

- [ ] **Step 5: Commit**

```bash
git add components/VideoPlayer/engine/playbackReducer.ts __tests__/player/engine/playbackReducer.test.ts
git commit -m "feat(player): add playback reducer with source/status/playing transitions

Verified: npm test -- --testPathPattern=engine/playbackReducer => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: playbackReducer — time, end, stall, app state, field events, invariants

**Files:**
- Modify: `__tests__/player/engine/playbackReducer.test.ts` (append part B)
- Modify: `components/VideoPlayer/engine/playbackReducer.ts` only if a part B test fails

- [ ] **Step 1: Append part B tests**

Append to `__tests__/player/engine/playbackReducer.test.ts`:

```ts
const timeUpdate = (positionMs: number, bufferedMs = 0, durationMs = 0, liveOffsetMs: number | null = null): EngineEvent => ({
  type: "timeUpdate",
  positionMs,
  bufferedMs,
  durationMs,
  liveOffsetMs,
});
const playToEnd: EngineEvent = { type: "playToEnd" };
const stall: EngineEvent = { type: "stall" };
const appBackground: EngineEvent = { type: "appBackground" };
const appForeground: EngineEvent = { type: "appForeground" };

const PART_B: readonly Row[] = [
  // timeUpdate
  ["idle", timeUpdate(1), "ignored", "idle + time"],
  ["loading", timeUpdate(1), "loading", "loading + time"],
  ["ready", timeUpdate(1), "ready", "ready + time"],
  ["playing", timeUpdate(1), "playing", "playing + time"],
  ["paused", timeUpdate(1), "paused", "paused + time"],
  ["buffering", timeUpdate(1), "buffering", "buffering + time (not enough buffer)"],
  ["ended", timeUpdate(1), "ended", "ended + time"],
  ["error", timeUpdate(1), "ignored", "error + time"],
  // playToEnd
  ["idle", playToEnd, "ignored", "idle + end"],
  ["loading", playToEnd, "ignored", "loading + end"],
  ["ready", playToEnd, "ended", "ready + end"],
  ["playing", playToEnd, "ended", "playing + end"],
  ["paused", playToEnd, "ended", "paused + end"],
  ["buffering", playToEnd, "ended", "buffering + end"],
  ["ended", playToEnd, "ignored", "ended + end"],
  ["error", playToEnd, "ignored", "error + end"],
  // stall
  ...ALL_STATUSES.map((s): Row => [s, stall, s === "playing" ? "buffering" : "ignored", `${s} + stall`]),
  // appBackground
  ["idle", appBackground, "ignored", "idle + bg"],
  ["loading", appBackground, "loading", "loading + bg"],
  ["ready", appBackground, "ready", "ready + bg"],
  ["playing", appBackground, "paused", "playing + bg"],
  ["paused", appBackground, "paused", "paused + bg"],
  ["buffering", appBackground, "paused", "buffering + bg"],
  ["ended", appBackground, "ended", "ended + bg"],
  ["error", appBackground, "error", "error + bg"],
  // appForeground: never changes status; ignored only in idle
  ...ALL_STATUSES.map((s): Row => [s, appForeground, s === "idle" ? "ignored" : s, `${s} + fg`]),
];

describe("playbackReducer part B: time, end, stall, app state", () => {
  beforeEach(() => resetDevLogDedupe());

  it.each(PART_B)("%s + %o → %s (%s)", (from, event, expected) => {
    const prev = at(from);
    const next = playbackReducer(prev, event);
    if (expected === "ignored") expect(next).toBe(prev);
    else expect(next.status).toBe(expected);
  });

  it("timeUpdate updates position, buffered, duration and clamps position to duration", () => {
    const next = playbackReducer(at("playing"), timeUpdate(150_000, 160_000, 100_000));
    expect(next).toMatchObject({ positionMs: 100_000, bufferedMs: 160_000, durationMs: 100_000 });
  });

  it("timeUpdate keeps the previous duration when the event reports 0", () => {
    const next = playbackReducer(at("playing", { durationMs: 90_000 }), timeUpdate(1_000, 2_000, 0));
    expect(next.durationMs).toBe(90_000);
  });

  it("timeUpdate keeps liveOffsetMs only for live sources", () => {
    expect(playbackReducer(at("playing", { isLive: true }), timeUpdate(1, 1, 0, 12_000)).liveOffsetMs).toBe(12_000);
    expect(playbackReducer(at("playing", { isLive: false }), timeUpdate(1, 1, 0, 12_000)).liveOffsetMs).toBeNull();
  });

  it("buffering returns to playing when the buffer is ahead by more than MIN_BUFFER_AHEAD_MS", () => {
    const next = playbackReducer(at("buffering"), timeUpdate(10_000, 10_000 + 501, 100_000));
    expect(next.status).toBe("playing");
    const still = playbackReducer(at("buffering"), timeUpdate(10_000, 10_000 + 500, 100_000));
    expect(still.status).toBe("buffering");
  });

  it("ended updates position only", () => {
    const next = playbackReducer(at("ended", { durationMs: 50_000, bufferedMs: 5 }), timeUpdate(0, 999, 60_000));
    expect(next).toMatchObject({ positionMs: 0, bufferedMs: 5, durationMs: 50_000 });
  });

  it("identical timeUpdate returns prev by reference (no re-render)", () => {
    const prev = at("playing", { positionMs: 1_000, bufferedMs: 2_000, durationMs: 3_000 });
    expect(playbackReducer(prev, timeUpdate(1_000, 2_000, 3_000))).toBe(prev);
  });

  it("appBackground from playing records isPlayingBeforeBackground; from paused clears it", () => {
    expect(playbackReducer(at("playing"), appBackground).isPlayingBeforeBackground).toBe(true);
    expect(playbackReducer(at("paused", { isPlayingBeforeBackground: true }), appBackground).isPlayingBeforeBackground).toBe(false);
  });

  it("sourceLoaded sets duration and upgrades isLive but never downgrades it", () => {
    const a = playbackReducer(at("loading"), { type: "sourceLoaded", durationMs: 42_000, isLive: true });
    expect(a).toMatchObject({ durationMs: 42_000, isLive: true });
    const b = playbackReducer(at("loading", { isLive: true, durationMs: 5 }), { type: "sourceLoaded", durationMs: 0, isLive: false });
    expect(b).toMatchObject({ durationMs: 5, isLive: true });
  });
});

describe("playbackReducer field events", () => {
  beforeEach(() => resetDevLogDedupe());

  const quality = { id: "q1", width: 1280, height: 720, bitrate: 2_000_000, label: "720p" };
  const sub = { id: "s1", language: "hi", label: "Hindi" };

  it.each<[EngineEvent, Partial<PlaybackSnapshot>]>([
    [{ type: "rateChange", rate: 1.5 }, { playbackRate: 1.5 }],
    [{ type: "mutedChange", muted: true }, { muted: true }],
    [{ type: "volumeChange", volume: 0.25 }, { volume: 0.25 }],
    [{ type: "volumeChange", volume: 7 }, { volume: 1 }],
    [{ type: "qualitiesChange", qualities: [quality], active: quality }, { qualities: [quality], activeQuality: quality }],
    [{ type: "subtitlesChange", tracks: [sub], active: null }, { subtitleTracks: [sub], activeSubtitle: null }],
    [{ type: "pipChange", active: true }, { isPictureInPicture: true }],
  ])("%o updates fields and keeps status", (event, expected) => {
    for (const status of ALL_STATUSES) {
      const prev = at(status);
      const next = playbackReducer(prev, event);
      if (status === "idle") expect(next).toBe(prev);
      else {
        expect(next.status).toBe(status);
        expect(next).toMatchObject(expected);
      }
    }
  });

  it("retryScheduled only applies in error and is capped at MAX_RETRIES", () => {
    expect(playbackReducer(at("error"), { type: "retryScheduled", attempt: 2 }).retryAttempt).toBe(2);
    expect(playbackReducer(at("error"), { type: "retryScheduled", attempt: 99 }).retryAttempt).toBe(3);
    const prev = at("playing");
    expect(playbackReducer(prev, { type: "retryScheduled", attempt: 1 })).toBe(prev);
  });
});

describe("playbackReducer invariants", () => {
  const EVENTS: readonly EngineEvent[] = [
    sourceSet, loading, ready, nativeError, playing, notPlaying, disposed, playToEnd, stall, appBackground, appForeground,
    timeUpdate(5_000, 9_000, 8_000, 100), { type: "sourceLoaded", durationMs: 1, isLive: false },
    { type: "rateChange", rate: 2 }, { type: "mutedChange", muted: true }, { type: "volumeChange", volume: 2 },
    { type: "pipChange", active: true }, { type: "retryScheduled", attempt: 9 },
  ];

  it("hold after every (status, event) pair", () => {
    for (const status of ALL_STATUSES) {
      for (const event of EVENTS) {
        const next = playbackReducer(at(status, { positionMs: 7_000, durationMs: 8_000, bufferedMs: 7_500 }), event);
        expect(next.positionMs).toBeGreaterThanOrEqual(0);
        if (next.durationMs > 0) expect(next.positionMs).toBeLessThanOrEqual(next.durationMs);
        expect(next.error !== null).toBe(next.status === "error");
        expect(next.retryAttempt).toBeLessThanOrEqual(3);
        expect(next.volume).toBeGreaterThanOrEqual(0);
        expect(next.volume).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- --testPathPattern=engine/playbackReducer`
Expected: all pass. If the invariant "error !== null iff status error" fails for `at("error")` combined with `appForeground` or field events, the fixture is correct (it sets `error`) and the reducer is right; check the failing pair in the output and fix the reducer only if it truly violates the table.

- [ ] **Step 3: Check the line budget and commit**

Run: `wc -l components/VideoPlayer/engine/playbackReducer.ts`
Expected: under 300.

```bash
git add __tests__/player/engine/playbackReducer.test.ts components/VideoPlayer/engine/playbackReducer.ts
git commit -m "test(player): cover reducer time, end, stall, app-state, field events and invariants

Verified: npm test -- --testPathPattern=engine/playbackReducer => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Fake expo-video player for tests

**Files:**
- Create: `__tests__/player/fakes/fakeVideoPlayer.ts`
- Test: `__tests__/player/fakes/fakeVideoPlayer.test.ts`

**Interfaces:**
- Produces: `createFakeVideoPlayer(overrides?): FakeVideoPlayer` where `FakeVideoPlayer` has mutable player properties, `jest.Mock` methods, `emit(event, payload)`, `listenerCount(event)`, `replaceCalls`. Tasks 9–12 use it. The engine's `EngineVideoPlayer` type (Task 9) is satisfied via `fake.asPlayer()`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/player/fakes/fakeVideoPlayer.test.ts
import { createFakeVideoPlayer } from "./fakeVideoPlayer";

describe("fakeVideoPlayer", () => {
  it("records listeners and emits to them; remove() detaches", () => {
    const fake = createFakeVideoPlayer();
    const handler = jest.fn();
    const sub = fake.addListener("playToEnd", handler);
    expect(fake.listenerCount("playToEnd")).toBe(1);
    fake.emit("playToEnd", undefined);
    expect(handler).toHaveBeenCalledTimes(1);
    sub.remove();
    expect(fake.listenerCount("playToEnd")).toBe(0);
  });

  it("play() and pause() flip playing and emit playingChange", () => {
    const fake = createFakeVideoPlayer();
    const handler = jest.fn();
    fake.addListener("playingChange", handler);
    fake.play();
    expect(fake.playing).toBe(true);
    expect(handler).toHaveBeenLastCalledWith({ isPlaying: true, oldIsPlaying: false });
    fake.pause();
    expect(fake.playing).toBe(false);
  });

  it("replace() records the source, sets status loading and emits statusChange", () => {
    const fake = createFakeVideoPlayer();
    const handler = jest.fn();
    fake.addListener("statusChange", handler);
    fake.replace({ uri: "https://x/v.mp4" });
    expect(fake.replaceCalls).toHaveLength(1);
    expect(fake.status).toBe("loading");
    expect(handler).toHaveBeenCalledWith({ status: "loading", oldStatus: "idle" });
  });

  it("seekBy clamps to duration", () => {
    const fake = createFakeVideoPlayer({ duration: 10, currentTime: 8 });
    fake.seekBy(5);
    expect(fake.currentTime).toBe(10);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern=fakes/fakeVideoPlayer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// __tests__/player/fakes/fakeVideoPlayer.ts
// Scripted stand-in for expo-video's VideoPlayer, shaped to the subset the
// engine uses (EngineVideoPlayer). Tests drive events with emit().
import type { EngineVideoPlayer } from "../../../components/VideoPlayer/engine/PlaybackEngine";

type Handler = (payload: unknown) => void;

export interface FakeSubtitleTrack {
  id: string;
  language: string;
  label: string;
}
export interface FakeVideoTrack {
  id: string;
  size: { width: number; height: number };
  mimeType: string | null;
  isSupported: boolean;
  bitrate: number | null;
  frameRate: number | null;
}

export interface FakeVideoPlayer {
  // mutable state
  playing: boolean;
  loop: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  timeUpdateEventInterval: number;
  keepScreenOnWhilePlaying: boolean;
  staysActiveInBackground: boolean;
  showNowPlayingNotification: boolean;
  preservesPitch: boolean;
  isLive: boolean;
  status: "idle" | "loading" | "readyToPlay" | "error";
  bufferedPosition: number;
  currentLiveTimestamp: number | null;
  currentOffsetFromLive: number | null;
  targetOffsetFromLive: number;
  subtitleTrack: FakeSubtitleTrack | null;
  availableSubtitleTracks: FakeSubtitleTrack[];
  videoTrack: FakeVideoTrack | null;
  availableVideoTracks: FakeVideoTrack[];
  // methods
  play: jest.Mock<void, []>;
  pause: jest.Mock<void, []>;
  replace: jest.Mock<void, [unknown]>;
  replay: jest.Mock<void, []>;
  seekBy: jest.Mock<void, [number]>;
  addListener: (event: string, handler: Handler) => { remove: () => void };
  // test helpers
  emit(event: string, payload: unknown): void;
  listenerCount(event: string): number;
  replaceCalls: unknown[];
  asPlayer(): EngineVideoPlayer;
}

export function createFakeVideoPlayer(overrides: Partial<FakeVideoPlayer> = {}): FakeVideoPlayer {
  const listeners = new Map<string, Set<Handler>>();

  const fake: FakeVideoPlayer = {
    playing: false,
    loop: false,
    muted: false,
    currentTime: 0,
    duration: 100,
    volume: 1,
    playbackRate: 1,
    timeUpdateEventInterval: 0,
    keepScreenOnWhilePlaying: false,
    staysActiveInBackground: true,
    showNowPlayingNotification: true,
    preservesPitch: false,
    isLive: false,
    status: "idle",
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    targetOffsetFromLive: 0,
    subtitleTrack: null,
    availableSubtitleTracks: [],
    videoTrack: null,
    availableVideoTracks: [],
    replaceCalls: [],
    play: jest.fn(() => {
      const old = fake.playing;
      fake.playing = true;
      fake.emit("playingChange", { isPlaying: true, oldIsPlaying: old });
    }),
    pause: jest.fn(() => {
      const old = fake.playing;
      fake.playing = false;
      fake.emit("playingChange", { isPlaying: false, oldIsPlaying: old });
    }),
    replace: jest.fn((source: unknown) => {
      fake.replaceCalls.push(source);
      const old = fake.status;
      fake.status = "loading";
      fake.playing = false;
      fake.emit("statusChange", { status: "loading", oldStatus: old });
    }),
    replay: jest.fn(() => {
      fake.currentTime = 0;
      fake.play();
    }),
    seekBy: jest.fn((seconds: number) => {
      const target = fake.currentTime + seconds;
      fake.currentTime = Number.isFinite(fake.duration) && fake.duration > 0 ? Math.min(fake.duration, Math.max(0, target)) : Math.max(0, target);
    }),
    addListener: (event, handler) => {
      const set = listeners.get(event) ?? new Set<Handler>();
      set.add(handler);
      listeners.set(event, set);
      return {
        remove: () => {
          set.delete(handler);
        },
      };
    },
    emit: (event, payload) => {
      for (const handler of listeners.get(event) ?? []) handler(payload);
    },
    listenerCount: (event) => listeners.get(event)?.size ?? 0,
    asPlayer: () => fake as unknown as EngineVideoPlayer,
    ...overrides,
  };
  return fake;
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern=fakes/fakeVideoPlayer`
Expected: 4 passed (the `EngineVideoPlayer` import is type-only; Task 9 creates the module. Until then TypeScript in Jest is transpiled by Babel without type checking, so the test runs. `npx tsc` will complain until Task 9 lands; that is expected within this task pair and is resolved in the same increment).

```bash
git add __tests__/player/fakes/fakeVideoPlayer.ts __tests__/player/fakes/fakeVideoPlayer.test.ts
git commit -m "test(player): add scripted fake expo-video player

Verified: npm test -- --testPathPattern=fakes/fakeVideoPlayer => 4 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: PlaybackEngine — construction, subscriptions, setup, dispose, setSource, first ready

**Files:**
- Create: `components/VideoPlayer/engine/PlaybackEngine.ts`
- Test: `__tests__/player/engine/PlaybackEngine.test.ts`

**Interfaces:**
- Produces: `export type EngineVideoPlayer`; `export class PlaybackEngine { constructor(player: EngineVideoPlayer, options: EngineOptions, onSnapshot: (s: PlaybackSnapshot) => void); readonly commands: PlaybackCommands; getSnapshot(): PlaybackSnapshot; setSource(source: VideoPlayerSource, startMs?: number): void; notifyAppState(state: "active" | "background" | "inactive" | "unknown" | "extension"): void; notifyPictureInPicture(active: boolean): void; dispose(): void; get lastKnownPositionMs(): number }`.
- Rules covered here: E1, E2, E3, E10, E12, E13.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/player/engine/PlaybackEngine.test.ts`:

```ts
// __tests__/player/engine/PlaybackEngine.test.ts
// Rules E1-E13: docs/player/04-playback-engine-spec.md §4
import { PlaybackEngine } from "../../../components/VideoPlayer/engine/PlaybackEngine";
import { resetDevLogDedupe } from "../../../components/VideoPlayer/engine/devLog";
import type { EngineOptions, PlaybackSnapshot } from "../../../components/VideoPlayer/engine/types";
import type { VideoPlayerSource } from "../../../components/VideoPlayer/types";
import {
  LOAD_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  STALL_TIMEOUT_MS,
  TIME_UPDATE_INTERVAL_MS,
} from "../../../components/VideoPlayer/constants";
import { createFakeVideoPlayer, type FakeVideoPlayer } from "../fakes/fakeVideoPlayer";

const MP4: VideoPlayerSource = { url: "https://example.test/v.mp4?token=secret", kind: "mp4", isLive: false };
const HLS: VideoPlayerSource = { url: "https://example.test/s.m3u8", kind: "hls", isLive: false, headers: { Authorization: "Bearer abc" } };
const LIVE: VideoPlayerSource = { url: "https://example.test/live.m3u8", kind: "hls", isLive: true };

const OPTIONS: EngineOptions = { autoplay: true, loop: false, mutedByDefault: false, timeUpdateIntervalMs: TIME_UPDATE_INTERVAL_MS };

const SUBSCRIBED_EVENTS = [
  "statusChange", "playingChange", "timeUpdate", "playToEnd", "sourceChange", "sourceLoad",
  "playbackRateChange", "mutedChange", "volumeChange", "videoTrackChange",
  "availableSubtitleTracksChange", "subtitleTrackChange",
] as const;

function setup(options: Partial<EngineOptions> = {}, fakeOverrides: Partial<FakeVideoPlayer> = {}) {
  const fake = createFakeVideoPlayer(fakeOverrides);
  const snapshots: PlaybackSnapshot[] = [];
  const engine = new PlaybackEngine(fake.asPlayer(), { ...OPTIONS, ...options }, (s) => snapshots.push(s));
  return { fake, engine, snapshots, last: () => snapshots[snapshots.length - 1] ?? engine.getSnapshot() };
}

/** Drive the fake to readyToPlay and emit one timeUpdate. */
function becomeReady(fake: FakeVideoPlayer, duration = 100) {
  fake.duration = duration;
  fake.status = "readyToPlay";
  fake.emit("sourceLoad", { videoSource: null, duration, availableVideoTracks: [], availableSubtitleTracks: [], availableAudioTracks: [] });
  fake.emit("statusChange", { status: "readyToPlay", oldStatus: "loading" });
}

function tick(fake: FakeVideoPlayer, currentTime: number, bufferedPosition = currentTime + 5) {
  fake.currentTime = currentTime;
  fake.bufferedPosition = bufferedPosition;
  fake.emit("timeUpdate", { currentTime, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition });
}

beforeEach(() => {
  jest.useFakeTimers();
  resetDevLogDedupe();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("PlaybackEngine E1/E2: construction and dispose", () => {
  it("subscribes to every engine event once and applies setup properties", () => {
    const { fake } = setup();
    for (const event of SUBSCRIBED_EVENTS) expect(fake.listenerCount(event)).toBe(1);
    expect(fake.timeUpdateEventInterval).toBe(TIME_UPDATE_INTERVAL_MS / 1000);
    expect(fake.loop).toBe(false);
    expect(fake.muted).toBe(false);
    expect(fake.keepScreenOnWhilePlaying).toBe(true);
    expect(fake.staysActiveInBackground).toBe(false);
    expect(fake.showNowPlayingNotification).toBe(false);
    expect(fake.preservesPitch).toBe(true);
  });

  it("honours loop and mutedByDefault options", () => {
    const { fake } = setup({ loop: true, mutedByDefault: true });
    expect(fake.loop).toBe(true);
    expect(fake.muted).toBe(true);
  });

  it("dispose pauses, removes every listener, clears timers and goes idle", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    expect(jest.getTimerCount()).toBeGreaterThan(0); // load timer
    engine.dispose();
    for (const event of SUBSCRIBED_EVENTS) expect(fake.listenerCount(event)).toBe(0);
    expect(fake.pause).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(last().status).toBe("idle");
  });

  it("events after dispose do not publish snapshots", () => {
    const { fake, engine, snapshots } = setup();
    engine.dispose();
    const count = snapshots.length;
    fake.emit("playToEnd", undefined);
    expect(snapshots.length).toBe(count);
  });
});

describe("PlaybackEngine E3: setSource and first ready", () => {
  it("dispatches loading, resets rate, replaces with contentType by kind and never logs headers", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fake, engine, last } = setup();
    fake.playbackRate = 1.5;
    engine.setSource(HLS);
    expect(last().status).toBe("loading");
    expect(fake.playbackRate).toBe(1);
    expect(fake.replaceCalls[0]).toEqual({ uri: HLS.url, headers: { Authorization: "Bearer abc" }, contentType: "hls" });
    engine.setSource(MP4);
    expect(fake.replaceCalls[1]).toEqual({ uri: MP4.url, headers: undefined, contentType: "auto" });
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain("Bearer");
    expect(logged).not.toContain("token=secret");
    warn.mockRestore();
  });

  it("autoplay: plays after the first readyToPlay and reaches playing", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    expect(fake.play).toHaveBeenCalledTimes(1);
    expect(last().status).toBe("playing");
    expect(last().durationMs).toBe(100_000);
  });

  it("autoplay false: stays ready", () => {
    const { fake, engine, last } = setup({ autoplay: false });
    engine.setSource(MP4);
    becomeReady(fake);
    expect(fake.play).not.toHaveBeenCalled();
    expect(last().status).toBe("ready");
  });

  it("applies initialPositionMs once, only for the first source, not near the end, not for live", () => {
    const { fake, engine } = setup({ initialPositionMs: 42_000 });
    engine.setSource(MP4);
    becomeReady(fake, 100);
    expect(fake.currentTime).toBe(42);
    engine.setSource(HLS);
    fake.currentTime = 0;
    becomeReady(fake, 100);
    expect(fake.currentTime).toBe(0);

    const nearEnd = setup({ initialPositionMs: 99_500 });
    nearEnd.engine.setSource(MP4);
    becomeReady(nearEnd.fake, 100);
    expect(nearEnd.fake.currentTime).toBe(0);

    const live = setup({ initialPositionMs: 10_000 });
    live.engine.setSource(LIVE);
    live.fake.isLive = true;
    becomeReady(live.fake, 0);
    expect(live.fake.currentTime).toBe(0);
  });

  it("explicit startMs on setSource seeks after ready", () => {
    const { fake, engine } = setup();
    engine.setSource(MP4, 30_000);
    becomeReady(fake, 100);
    expect(fake.currentTime).toBe(30);
  });

  it("marks isLive from the source or from the native flag", () => {
    const a = setup();
    a.engine.setSource(LIVE);
    expect(a.last().isLive).toBe(true);
    const b = setup();
    b.engine.setSource(HLS);
    b.fake.isLive = true;
    becomeReady(b.fake, 0);
    expect(b.last().isLive).toBe(true);
  });

  it("E10: identical events do not publish a new snapshot", () => {
    const { fake, engine, snapshots } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 1);
    const count = snapshots.length;
    tick(fake, 1, 6);
    expect(snapshots.length).toBe(count);
  });

  it("E12: tracks lastKnownPositionMs from timeUpdate", () => {
    const { fake, engine } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 12.345);
    expect(engine.lastKnownPositionMs).toBe(12_345);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern=engine/PlaybackEngine`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the engine (complete file; Tasks 10–11 add tests only, unless a test exposes a defect)**

Create `components/VideoPlayer/engine/PlaybackEngine.ts`:

```ts
// components/VideoPlayer/engine/PlaybackEngine.ts
// Bridges one expo-video player to the pure reducer. Owns subscriptions,
// the stall/retry/load timers and command validation.
// Rules E1-E13: docs/player/04-playback-engine-spec.md §4
import type {
  AvailableSubtitleTracksChangeEventPayload,
  MutedChangeEventPayload,
  PlaybackRateChangeEventPayload,
  PlayingChangeEventPayload,
  SourceLoadEventPayload,
  StatusChangeEventPayload,
  SubtitleTrack,
  SubtitleTrackChangeEventPayload,
  TimeUpdateEventPayload,
  VideoPlayer,
  VideoTrack,
  VideoTrackChangeEventPayload,
  VolumeChangeEventPayload,
} from "expo-video";
import {
  ERROR_MESSAGES,
  LIVE_EDGE_SEEK_SECONDS,
  LOAD_TIMEOUT_MS,
  PLAYBACK_RATES,
  RESUME_NEAR_END_GUARD_MS,
  STALL_TIMEOUT_MS,
} from "../constants";
import type { VideoPlayerSource } from "../types";
import { classifyError } from "./classifyError";
import { devLog } from "./devLog";
import { createInitialSnapshot } from "./initialSnapshot";
import { playbackReducer } from "./playbackReducer";
import { clamp } from "./pure/clamp";
import { nextRetryDelayMs } from "./retryPolicy";
import type {
  EngineEvent,
  EngineOptions,
  PlaybackCommands,
  PlaybackError,
  PlaybackSnapshot,
  QualityTrack,
  SubtitleTrackInfo,
} from "./types";

export type EngineVideoPlayer = Pick<
  VideoPlayer,
  | "play" | "pause" | "replace" | "replay" | "seekBy" | "addListener"
  | "currentTime" | "duration" | "playing" | "muted" | "volume" | "playbackRate" | "loop"
  | "bufferedPosition" | "isLive" | "currentLiveTimestamp" | "currentOffsetFromLive" | "targetOffsetFromLive"
  | "timeUpdateEventInterval" | "keepScreenOnWhilePlaying" | "staysActiveInBackground"
  | "showNowPlayingNotification" | "preservesPitch" | "subtitleTrack" | "availableSubtitleTracks"
  | "videoTrack" | "availableVideoTracks" | "status"
>;

export type AppStateName = "active" | "background" | "inactive" | "unknown" | "extension";

type Disposable = { remove(): void };
type TimerName = "stall" | "retry" | "load";

const MS_PER_SECOND = 1000;

function toMs(seconds: number | null | undefined): number {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * MS_PER_SECOND) : 0;
}

function toQuality(track: VideoTrack): QualityTrack {
  const height = track.size?.height ?? 0;
  return {
    id: track.id,
    width: track.size?.width ?? 0,
    height,
    bitrate: track.bitrate ?? null,
    label: height > 0 ? `${height}p` : "Auto",
  };
}

function toSubtitle(track: SubtitleTrack): SubtitleTrackInfo {
  return { id: track.id, language: track.language, label: track.label };
}

export class PlaybackEngine {
  readonly commands: PlaybackCommands;

  private snapshot: PlaybackSnapshot = createInitialSnapshot();
  private readonly disposables: Disposable[] = [];
  private readonly timers: Record<TimerName, ReturnType<typeof setTimeout> | null> = { stall: null, retry: null, load: null };
  private currentSource: VideoPlayerSource | null = null;
  private pendingStartMs: number | undefined;
  private resumeAfterReady = false;
  private wasPlayingBeforeError = false;
  private lastKnownMs = 0;
  private disposed = false;

  constructor(
    private readonly player: EngineVideoPlayer,
    private readonly options: EngineOptions,
    private readonly onSnapshot: (snapshot: PlaybackSnapshot) => void,
  ) {
    this.applySetup();
    this.subscribe();
    this.commands = this.buildCommands();
  }

  get lastKnownPositionMs(): number {
    return this.lastKnownMs;
  }

  getSnapshot(): PlaybackSnapshot {
    return this.snapshot;
  }

  setSource(source: VideoPlayerSource, startMs?: number): void {
    if (this.disposed) return;
    this.clearTimer("retry");
    this.clearTimer("load");
    const isFirst = this.currentSource === null;
    this.currentSource = source;
    this.pendingStartMs = startMs ?? (isFirst ? this.options.initialPositionMs : undefined);
    this.resumeAfterReady = this.options.autoplay;
    this.lastKnownMs = 0;
    this.dispatch({ type: "sourceSet", isLive: source.isLive });
    this.safeCall(() => {
      this.player.playbackRate = 1;
    }, "resetRate");
    this.safeCall(
      () =>
        this.player.replace({
          uri: source.url,
          headers: source.headers ? { ...source.headers } : undefined,
          contentType: source.kind === "hls" ? "hls" : "auto",
        }),
      "replace",
    );
    this.startTimer("load", LOAD_TIMEOUT_MS, () => this.onLoadTimeout());
  }

  notifyAppState(state: AppStateName): void {
    if (this.disposed) return;
    if (state === "background" || state === "inactive") {
      const s = this.snapshot.status;
      if (s === "playing" || s === "buffering") this.safeCall(() => this.player.pause(), "pauseOnBackground");
      this.dispatch({ type: "appBackground" });
      return;
    }
    if (state === "active") this.dispatch({ type: "appForeground" });
  }

  notifyPictureInPicture(active: boolean): void {
    this.dispatch({ type: "pipChange", active });
  }

  dispose(): void {
    if (this.disposed) return;
    this.safeCall(() => this.player.pause(), "pauseOnDispose");
    for (const d of this.disposables.splice(0)) d.remove();
    this.clearTimer("stall");
    this.clearTimer("retry");
    this.clearTimer("load");
    this.dispatch({ type: "disposed" });
    this.disposed = true;
  }

  // ---- setup and subscriptions (E1, E2) ----

  private applySetup(): void {
    this.safeCall(() => {
      this.player.timeUpdateEventInterval = this.options.timeUpdateIntervalMs / MS_PER_SECOND;
      this.player.loop = this.options.loop;
      this.player.muted = this.options.mutedByDefault;
      this.player.keepScreenOnWhilePlaying = true;
      this.player.staysActiveInBackground = false;
      this.player.showNowPlayingNotification = false;
      this.player.preservesPitch = true;
    }, "setup");
  }

  private subscribe(): void {
    const p = this.player;
    this.disposables.push(
      p.addListener("statusChange", this.handleStatusChange),
      p.addListener("playingChange", this.handlePlayingChange),
      p.addListener("timeUpdate", this.handleTimeUpdate),
      p.addListener("playToEnd", this.handlePlayToEnd),
      p.addListener("sourceChange", this.handleSourceChange),
      p.addListener("sourceLoad", this.handleSourceLoad),
      p.addListener("playbackRateChange", this.handleRateChange),
      p.addListener("mutedChange", this.handleMutedChange),
      p.addListener("volumeChange", this.handleVolumeChange),
      p.addListener("videoTrackChange", this.handleVideoTrackChange),
      p.addListener("availableSubtitleTracksChange", this.handleSubtitleTracksChange),
      p.addListener("subtitleTrackChange", this.handleSubtitleTrackChange),
    );
  }

  // ---- event handlers ----

  private readonly handleStatusChange = (payload: StatusChangeEventPayload): void => {
    switch (payload.status) {
      case "readyToPlay": {
        this.clearTimer("load");
        const wasLoading = this.snapshot.status === "loading";
        this.dispatch({ type: "statusChange", status: "readyToPlay" });
        if (wasLoading) this.onFirstReady();
        return;
      }
      case "error":
        this.onNativeError(classifyError(payload.error?.message));
        return;
      case "loading":
        this.dispatch({ type: "statusChange", status: "loading" });
        return;
      case "idle":
        return;
    }
  };

  private readonly handlePlayingChange = (payload: PlayingChangeEventPayload): void => {
    // ExoPlayer reports playing=false at the start of a rebuffer; surface it as buffering.
    if (!payload.isPlaying && this.snapshot.status === "playing" && this.player.status === "loading") {
      this.dispatch({ type: "statusChange", status: "loading" });
      return;
    }
    this.dispatch({ type: "playingChange", isPlaying: payload.isPlaying });
  };

  private readonly handleTimeUpdate = (payload: TimeUpdateEventPayload): void => {
    this.lastKnownMs = toMs(payload.currentTime);
    this.dispatch({
      type: "timeUpdate",
      positionMs: this.lastKnownMs,
      bufferedMs: payload.bufferedPosition >= 0 ? toMs(payload.bufferedPosition) : 0,
      durationMs: toMs(this.player.duration),
      liveOffsetMs: payload.currentOffsetFromLive === null ? null : toMs(payload.currentOffsetFromLive),
    });
    if (this.snapshot.status === "playing") this.startTimer("stall", STALL_TIMEOUT_MS, () => this.onStall());
  };

  private readonly handlePlayToEnd = (): void => {
    this.dispatch({ type: "playToEnd" });
  };

  private readonly handleSourceChange = (): void => {
    // Informational only; sourceSet already moved the reducer.
  };

  private readonly handleSourceLoad = (payload: SourceLoadEventPayload): void => {
    this.dispatch({ type: "sourceLoaded", durationMs: toMs(payload.duration), isLive: this.snapshot.isLive || this.player.isLive });
  };

  private readonly handleRateChange = (payload: PlaybackRateChangeEventPayload): void => {
    this.dispatch({ type: "rateChange", rate: payload.playbackRate });
  };

  private readonly handleMutedChange = (payload: MutedChangeEventPayload): void => {
    this.dispatch({ type: "mutedChange", muted: payload.muted });
  };

  private readonly handleVolumeChange = (payload: VolumeChangeEventPayload): void => {
    this.dispatch({ type: "volumeChange", volume: payload.volume });
  };

  private readonly handleVideoTrackChange = (payload: VideoTrackChangeEventPayload): void => {
    this.dispatch({
      type: "qualitiesChange",
      qualities: (this.player.availableVideoTracks ?? []).map(toQuality),
      active: payload.videoTrack ? toQuality(payload.videoTrack) : null,
    });
  };

  private readonly handleSubtitleTracksChange = (payload: AvailableSubtitleTracksChangeEventPayload): void => {
    this.dispatch({
      type: "subtitlesChange",
      tracks: payload.availableSubtitleTracks.map(toSubtitle),
      active: this.player.subtitleTrack ? toSubtitle(this.player.subtitleTrack) : null,
    });
  };

  private readonly handleSubtitleTrackChange = (payload: SubtitleTrackChangeEventPayload): void => {
    this.dispatch({
      type: "subtitlesChange",
      tracks: this.snapshot.subtitleTracks,
      active: payload.subtitleTrack ? toSubtitle(payload.subtitleTrack) : null,
    });
  };

  // ---- load, stall, error, retry (E3-E6, E11) ----

  private onFirstReady(): void {
    const durationMs = toMs(this.player.duration);
    const isLive = this.snapshot.isLive || this.player.isLive;
    if (durationMs > 0 || isLive !== this.snapshot.isLive) this.dispatch({ type: "sourceLoaded", durationMs, isLive });
    const start = this.pendingStartMs;
    this.pendingStartMs = undefined;
    if (start !== undefined && start > 0 && !isLive && durationMs > 0 && start < durationMs - RESUME_NEAR_END_GUARD_MS) {
      this.safeCall(() => {
        this.player.currentTime = start / MS_PER_SECOND;
      }, "seekStart");
      this.lastKnownMs = start;
    }
    if (this.resumeAfterReady) this.safeCall(() => this.player.play(), "autoplay");
  }

  private onLoadTimeout(): void {
    this.timers.load = null;
    if (this.snapshot.status !== "loading") return;
    this.onNativeError({ code: "network", message: ERROR_MESSAGES.network, retryable: true, cause: "load timeout" });
  }

  private onStall(): void {
    this.timers.stall = null;
    this.dispatch({ type: "stall" });
  }

  private onNativeError(error: PlaybackError): void {
    this.clearTimer("load");
    this.clearTimer("stall");
    const s = this.snapshot.status;
    this.wasPlayingBeforeError = s === "playing" || s === "buffering" || (s === "loading" && this.resumeAfterReady);
    this.dispatch({ type: "statusChange", status: "error", error });
    const delay = nextRetryDelayMs(this.snapshot.retryAttempt, error);
    if (delay === null) return;
    this.dispatch({ type: "retryScheduled", attempt: this.snapshot.retryAttempt + 1 });
    this.startTimer("retry", delay, () => this.retrySource());
  }

  private retrySource(): void {
    this.timers.retry = null;
    const source = this.currentSource;
    if (!source || this.disposed) return;
    this.pendingStartMs = this.lastKnownMs;
    this.resumeAfterReady = this.wasPlayingBeforeError;
    this.dispatch({ type: "statusChange", status: "loading" });
    this.safeCall(
      () =>
        this.player.replace({
          uri: source.url,
          headers: source.headers ? { ...source.headers } : undefined,
          contentType: source.kind === "hls" ? "hls" : "auto",
        }),
      "replaceRetry",
    );
    this.startTimer("load", LOAD_TIMEOUT_MS, () => this.onLoadTimeout());
  }

  // ---- commands (E7) ----

  private allowed(name: string): boolean {
    const s = this.snapshot.status;
    if (s === "idle" || s === "loading" || s === "error") {
      devLog(`command.noop.${name}.${s}`);
      return false;
    }
    return true;
  }

  private seekToMs(positionMs: number, name: string): void {
    if (!this.allowed(name)) return;
    const { durationMs, isLive } = this.snapshot;
    if (isLive && durationMs <= 0) {
      devLog("command.noop.seek.liveNoWindow");
      return;
    }
    const target = durationMs > 0 ? clamp(Math.round(positionMs), 0, durationMs) : Math.max(0, Math.round(positionMs));
    this.safeCall(() => {
      this.player.currentTime = target / MS_PER_SECOND;
    }, name);
    this.lastKnownMs = target;
    this.dispatch({
      type: "timeUpdate",
      positionMs: target,
      bufferedMs: this.snapshot.bufferedMs,
      durationMs: this.snapshot.durationMs,
      liveOffsetMs: this.snapshot.liveOffsetMs,
    });
  }

  private buildCommands(): PlaybackCommands {
    return {
      play: () => {
        if (this.allowed("play")) this.safeCall(() => this.player.play(), "play");
      },
      pause: () => {
        if (this.allowed("pause")) this.safeCall(() => this.player.pause(), "pause");
      },
      togglePlay: () => {
        if (!this.allowed("togglePlay")) return;
        const s = this.snapshot.status;
        if (s === "playing" || s === "buffering") this.safeCall(() => this.player.pause(), "pause");
        else if (s === "ended") this.safeCall(() => this.player.replay(), "replay");
        else this.safeCall(() => this.player.play(), "play");
      },
      seekTo: (positionMs) => this.seekToMs(positionMs, "seekTo"),
      seekBy: (deltaMs) => this.seekToMs(this.snapshot.positionMs + deltaMs, "seekBy"),
      setRate: (rate) => {
        if (!(PLAYBACK_RATES as readonly number[]).includes(rate)) {
          devLog("command.invalid.setRate", { rate });
          return;
        }
        if (this.allowed("setRate"))
          this.safeCall(() => {
            this.player.playbackRate = rate;
          }, "setRate");
      },
      setMuted: (muted) => {
        if (this.snapshot.status === "idle") return;
        this.safeCall(() => {
          this.player.muted = muted;
        }, "setMuted");
      },
      setVolume: (volume) => {
        if (this.snapshot.status === "idle") return;
        const v = clamp(volume, 0, 1);
        this.safeCall(() => {
          this.player.volume = v;
          if (v > 0 && this.player.muted) this.player.muted = false;
        }, "setVolume");
      },
      selectQuality: () => {
        devLog("command.unsupported.selectQuality");
      },
      selectSubtitle: (track) => {
        if (!this.allowed("selectSubtitle")) return;
        this.safeCall(() => {
          this.player.subtitleTrack = track ? this.player.availableSubtitleTracks.find((t) => t.id === track.id) ?? null : null;
        }, "selectSubtitle");
      },
      goToLive: () => {
        if (!this.allowed("goToLive") || !this.snapshot.isLive) return;
        this.safeCall(() => {
          this.player.targetOffsetFromLive = 0;
          const d = this.player.duration;
          if (Number.isFinite(d) && d > 0) this.player.currentTime = d;
          else this.player.seekBy(LIVE_EDGE_SEEK_SECONDS);
        }, "goToLive");
      },
      retry: () => {
        if (this.snapshot.status !== "error" || !this.currentSource) {
          devLog(`command.noop.retry.${this.snapshot.status}`);
          return;
        }
        this.clearTimer("retry");
        const source = this.currentSource;
        const resumeAt = this.lastKnownMs;
        this.setSource(source, resumeAt);
        this.resumeAfterReady = true;
      },
      replay: () => {
        if (this.allowed("replay")) this.safeCall(() => this.player.replay(), "replay");
      },
    };
  }

  // ---- internals ----

  private dispatch(event: EngineEvent): void {
    if (this.disposed) return;
    const next = playbackReducer(this.snapshot, event);
    if (next === this.snapshot) return;
    this.snapshot = next;
    this.syncStallTimer();
    this.onSnapshot(next);
  }

  private syncStallTimer(): void {
    if (this.snapshot.status === "playing") {
      if (this.timers.stall === null) this.startTimer("stall", STALL_TIMEOUT_MS, () => this.onStall());
    } else {
      this.clearTimer("stall");
    }
  }

  private startTimer(name: TimerName, delayMs: number, fn: () => void): void {
    this.clearTimer(name);
    this.timers[name] = setTimeout(fn, delayMs);
  }

  private clearTimer(name: TimerName): void {
    const t = this.timers[name];
    if (t !== null) {
      clearTimeout(t);
      this.timers[name] = null;
    }
  }

  /** E13: no native call throws into the engine; failures are dev-logged once per label. */
  private safeCall(fn: () => void, label: string): boolean {
    try {
      fn();
      return true;
    } catch (cause) {
      devLog(`native.failed.${label}`, { cause: String(cause) });
      return false;
    }
  }
}
```

- [ ] **Step 4: Run and type-check**

Run: `npm test -- --testPathPattern=engine/PlaybackEngine`
Expected: all Task 9 tests pass.

Run: `npx tsc --noEmit 2>&1 | grep "components/VideoPlayer\|__tests__/player"`
Expected: no output. If `expo-video` does not export a payload type by the name used, import it from `"expo-video/build/VideoPlayerEvents.types"` instead and record that in the report. If `Pick<VideoPlayer, "addListener">` produces an incompatible generic in the fake, keep `asPlayer()`'s `unknown` cast (already present) and do not weaken the engine type.

- [ ] **Step 5: Commit**

```bash
git add components/VideoPlayer/engine/PlaybackEngine.ts __tests__/player/engine/PlaybackEngine.test.ts
git commit -m "feat(player): add PlaybackEngine with subscriptions, setup, source loading and dispose

Verified: npm test -- --testPathPattern=engine/PlaybackEngine => <N> passed
Verified: npx tsc --noEmit => no errors in components/VideoPlayer or __tests__/player

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: PlaybackEngine — stall, errors, retry, load timeout (E4, E6, E11)

**Files:**
- Modify: `__tests__/player/engine/PlaybackEngine.test.ts` (append)
- Modify: `components/VideoPlayer/engine/PlaybackEngine.ts` only if a test fails

- [ ] **Step 1: Append the tests**

```ts
describe("PlaybackEngine E4: stall detection", () => {
  it("enters buffering after STALL_TIMEOUT_MS without timeUpdate, recovers on progress", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 1);
    jest.advanceTimersByTime(STALL_TIMEOUT_MS - 1);
    expect(last().status).toBe("playing");
    jest.advanceTimersByTime(1);
    expect(last().status).toBe("buffering");
    tick(fake, 1.1, 5); // buffered ahead > MIN_BUFFER_AHEAD_MS
    expect(last().status).toBe("playing");
  });

  it("clears the stall timer when paused", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 1);
    fake.pause();
    expect(last().status).toBe("paused");
    jest.advanceTimersByTime(STALL_TIMEOUT_MS * 2);
    expect(last().status).toBe("paused");
  });

  it("treats playing=false while native status is loading as buffering (ExoPlayer rebuffer)", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    fake.status = "loading";
    fake.playing = false;
    fake.emit("playingChange", { isPlaying: false, oldIsPlaying: true });
    expect(last().status).toBe("buffering");
  });
});

describe("PlaybackEngine E6/E11: errors and retry", () => {
  const nativeNetworkError = (fake: FakeVideoPlayer) => {
    fake.status = "error";
    fake.emit("statusChange", { status: "error", oldStatus: "readyToPlay", error: { message: "Network timed out" } });
  };

  it("schedules retries at 1s, 2s, 4s then stops in error with retryAttempt 3", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 20);

    nativeNetworkError(fake);
    expect(last().status).toBe("error");
    expect(last().error?.code).toBe("network");
    expect(last().retryAttempt).toBe(1);
    expect(fake.replaceCalls).toHaveLength(1);

    jest.advanceTimersByTime(RETRY_DELAYS_MS[0]);
    expect(fake.replaceCalls).toHaveLength(2);
    expect(last().status).toBe("loading");
    nativeNetworkError(fake);
    expect(last().retryAttempt).toBe(2);

    jest.advanceTimersByTime(RETRY_DELAYS_MS[1]);
    expect(fake.replaceCalls).toHaveLength(3);
    nativeNetworkError(fake);
    expect(last().retryAttempt).toBe(3);

    jest.advanceTimersByTime(RETRY_DELAYS_MS[2]);
    expect(fake.replaceCalls).toHaveLength(4);
    nativeNetworkError(fake);
    expect(last().retryAttempt).toBe(3);
    jest.advanceTimersByTime(60_000);
    expect(fake.replaceCalls).toHaveLength(4);
    expect(last().status).toBe("error");
  });

  it("retry resumes at the last known position and playing state", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 20);
    nativeNetworkError(fake);
    jest.advanceTimersByTime(RETRY_DELAYS_MS[0]);
    fake.currentTime = 0;
    becomeReady(fake);
    expect(fake.currentTime).toBe(20);
    expect(last().status).toBe("playing");
  });

  it("does not retry unsupported errors", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    fake.emit("statusChange", { status: "error", error: { message: "Unsupported codec" } });
    expect(last().error?.retryable).toBe(false);
    expect(last().retryAttempt).toBe(0);
    jest.advanceTimersByTime(60_000);
    expect(fake.replaceCalls).toHaveLength(1);
  });

  it("setSource during a pending retry cancels it", () => {
    const { fake, engine } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    nativeNetworkError(fake);
    engine.setSource(HLS);
    jest.advanceTimersByTime(60_000);
    expect(fake.replaceCalls).toHaveLength(2); // MP4 once, HLS once, no retry replace
  });

  it("manual retry after exhaustion resets the attempt counter and plays", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    tick(fake, 10);
    for (let i = 0; i < 4; i += 1) {
      nativeNetworkError(fake);
      jest.advanceTimersByTime(RETRY_DELAYS_MS[Math.min(i, 2)]);
    }
    expect(last().retryAttempt).toBe(3);
    engine.commands.retry();
    expect(last().status).toBe("loading");
    expect(last().retryAttempt).toBe(0);
    fake.currentTime = 0;
    becomeReady(fake);
    expect(fake.currentTime).toBe(10);
    expect(last().status).toBe("playing");
  });

  it("E11: load timeout produces a retryable network error", () => {
    const { engine, last } = setup();
    engine.setSource(MP4);
    jest.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(last().status).toBe("error");
    expect(last().error?.code).toBe("network");
    expect(last().error?.cause).toBe("load timeout");
    expect(last().retryAttempt).toBe(1);
  });

  it("readyToPlay before the timeout cancels it", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    jest.advanceTimersByTime(LOAD_TIMEOUT_MS * 2);
    expect(last().status).toBe("playing");
  });

  it("retry command is a no-op outside error", () => {
    const { fake, engine } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    engine.commands.retry();
    expect(fake.replaceCalls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- --testPathPattern=engine/PlaybackEngine`
Expected: all pass. If "manual retry after exhaustion" fails on `retryAttempt`, confirm `commands.retry()` calls `setSource` (which dispatches `sourceSet` and resets the counter) — that is the intended path.

- [ ] **Step 3: Commit**

```bash
git add __tests__/player/engine/PlaybackEngine.test.ts components/VideoPlayer/engine/PlaybackEngine.ts
git commit -m "test(player): cover stall detection, error classification, retry schedule and load timeout

Verified: npm test -- --testPathPattern=engine/PlaybackEngine => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: PlaybackEngine — commands, app state, picture-in-picture, tracks (E7, E8)

**Files:**
- Modify: `__tests__/player/engine/PlaybackEngine.test.ts` (append)

- [ ] **Step 1: Append the tests**

```ts
describe("PlaybackEngine E7: commands", () => {
  function ready(autoplay = false) {
    const ctx = setup({ autoplay });
    ctx.engine.setSource(MP4);
    becomeReady(ctx.fake, 100);
    tick(ctx.fake, 10, 30);
    return ctx;
  }

  it("play/pause/togglePlay call the player and follow status", () => {
    const { fake, engine, last } = ready();
    engine.commands.play();
    expect(last().status).toBe("playing");
    engine.commands.togglePlay();
    expect(last().status).toBe("paused");
    engine.commands.togglePlay();
    expect(last().status).toBe("playing");
    engine.commands.pause();
    expect(fake.pause).toHaveBeenCalled();
  });

  it("togglePlay in ended calls replay", () => {
    const { fake, engine, last } = ready(true);
    fake.emit("playToEnd", undefined);
    expect(last().status).toBe("ended");
    engine.commands.togglePlay();
    expect(fake.replay).toHaveBeenCalledTimes(1);
    expect(last().status).toBe("playing");
  });

  it("seekTo clamps to [0, duration] and publishes the position immediately", () => {
    const { fake, engine, last } = ready();
    engine.commands.seekTo(250_000);
    expect(fake.currentTime).toBe(100);
    expect(last().positionMs).toBe(100_000);
    engine.commands.seekTo(-5);
    expect(fake.currentTime).toBe(0);
    expect(last().positionMs).toBe(0);
  });

  it("seekBy adds to the current position", () => {
    const { fake, engine } = ready();
    engine.commands.seekBy(-10_000);
    expect(fake.currentTime).toBe(0);
    engine.commands.seekBy(45_000);
    expect(fake.currentTime).toBe(45);
  });

  it("S15: ten rapid seeks apply the last one without error", () => {
    const { fake, engine, last } = ready();
    for (let i = 1; i <= 10; i += 1) engine.commands.seekTo(i * 1_000);
    expect(fake.currentTime).toBe(10);
    expect(last().status).toBe("paused");
    expect(last().positionMs).toBe(10_000);
  });

  it("S16: twenty toggles end with parity", () => {
    const { engine, last } = ready();
    for (let i = 0; i < 20; i += 1) engine.commands.togglePlay();
    expect(last().status).toBe("paused");
    engine.commands.togglePlay();
    expect(last().status).toBe("playing");
  });

  it("seek is disabled for live without a window", () => {
    const { fake, engine } = setup();
    engine.setSource(LIVE);
    fake.isLive = true;
    becomeReady(fake, 0);
    fake.currentTime = 5;
    engine.commands.seekTo(1_000);
    expect(fake.currentTime).toBe(5);
  });

  it("setRate accepts only listed rates", () => {
    const { fake, engine } = ready();
    engine.commands.setRate(1.5);
    expect(fake.playbackRate).toBe(1.5);
    engine.commands.setRate(3);
    expect(fake.playbackRate).toBe(1.5);
  });

  it("setMuted and setVolume update the player; volume > 0 unmutes", () => {
    const { fake, engine } = ready();
    engine.commands.setMuted(true);
    expect(fake.muted).toBe(true);
    engine.commands.setVolume(0.5);
    expect(fake.volume).toBe(0.5);
    expect(fake.muted).toBe(false);
    engine.commands.setVolume(4);
    expect(fake.volume).toBe(1);
  });

  it("selectSubtitle sets the matching native track or null", () => {
    const { fake, engine } = ready();
    fake.availableSubtitleTracks = [{ id: "hi", language: "hi", label: "Hindi" }];
    engine.commands.selectSubtitle({ id: "hi", language: "hi", label: "Hindi" });
    expect(fake.subtitleTrack?.id).toBe("hi");
    engine.commands.selectSubtitle(null);
    expect(fake.subtitleTrack).toBeNull();
  });

  it("selectQuality is a no-op (read-only videoTrack in expo-video 3.0.11)", () => {
    const { fake, engine } = ready();
    engine.commands.selectQuality({ id: "x", width: 1, height: 1, bitrate: null, label: "1p" });
    expect(fake.videoTrack).toBeNull();
  });

  it("goToLive seeks to the edge only when live", () => {
    const vod = ready();
    vod.engine.commands.goToLive();
    expect(vod.fake.currentTime).toBe(10);

    const { fake, engine } = setup();
    engine.setSource(LIVE);
    fake.isLive = true;
    becomeReady(fake, 60);
    fake.currentTime = 20;
    engine.commands.goToLive();
    expect(fake.targetOffsetFromLive).toBe(0);
    expect(fake.currentTime).toBe(60);
  });

  it("commands are no-ops in loading and error (except retry)", () => {
    const { fake, engine } = setup();
    engine.setSource(MP4);
    engine.commands.play();
    engine.commands.seekTo(5);
    expect(fake.play).not.toHaveBeenCalled();
    expect(fake.currentTime).toBe(0);
  });
});

describe("PlaybackEngine E8: app state and PiP", () => {
  it("background pauses and records; foreground does not resume", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    expect(last().status).toBe("playing");
    engine.notifyAppState("background");
    expect(fake.pause).toHaveBeenCalledTimes(1);
    expect(last().status).toBe("paused");
    expect(last().isPlayingBeforeBackground).toBe(true);
    engine.notifyAppState("active");
    expect(fake.play).toHaveBeenCalledTimes(1); // only the autoplay call
    expect(last().status).toBe("paused");
  });

  it("background while paused does not call pause again", () => {
    const { fake, engine } = setup({ autoplay: false });
    engine.setSource(MP4);
    becomeReady(fake);
    engine.notifyAppState("inactive");
    expect(fake.pause).not.toHaveBeenCalled();
  });

  it("notifyPictureInPicture toggles the flag", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    engine.notifyPictureInPicture(true);
    expect(last().isPictureInPicture).toBe(true);
    engine.notifyPictureInPicture(false);
    expect(last().isPictureInPicture).toBe(false);
  });

  it("track events map to qualities and subtitles", () => {
    const { fake, engine, last } = setup();
    engine.setSource(MP4);
    becomeReady(fake);
    const track = { id: "v1", size: { width: 1280, height: 720 }, mimeType: "video/mp4", isSupported: true, bitrate: 2_000_000, frameRate: 30 };
    fake.availableVideoTracks = [track];
    fake.emit("videoTrackChange", { videoTrack: track, oldVideoTrack: null });
    expect(last().qualities).toEqual([{ id: "v1", width: 1280, height: 720, bitrate: 2_000_000, label: "720p" }]);
    expect(last().activeQuality?.label).toBe("720p");

    fake.emit("availableSubtitleTracksChange", { availableSubtitleTracks: [{ id: "hi", language: "hi", label: "Hindi" }] });
    expect(last().subtitleTracks).toEqual([{ id: "hi", language: "hi", label: "Hindi" }]);
    fake.emit("subtitleTrackChange", { subtitleTrack: { id: "hi", language: "hi", label: "Hindi" } });
    expect(last().activeSubtitle?.id).toBe("hi");
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- --testPathPattern=engine/PlaybackEngine`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add __tests__/player/engine/PlaybackEngine.test.ts components/VideoPlayer/engine/PlaybackEngine.ts
git commit -m "test(player): cover engine commands, app-state handling, PiP flag and track mapping

Verified: npm test -- --testPathPattern=engine/PlaybackEngine => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: usePlaybackEngine hook

**Files:**
- Create: `components/VideoPlayer/engine/usePlaybackEngine.ts`
- Test: `__tests__/player/engine/usePlaybackEngine.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface UsePlaybackEngineCallbacks { readonly onPositionChange?: (positionMs: number, durationMs: number) => void }
  export interface UsePlaybackEngineResult { readonly snapshot: PlaybackSnapshot; readonly commands: PlaybackCommands; readonly player: VideoPlayer; readonly notifyPictureInPicture: (active: boolean) => void }
  export function usePlaybackEngine(source: VideoPlayerSource, options: EngineOptions, callbacks?: UsePlaybackEngineCallbacks): UsePlaybackEngineResult
  ```
- Consumes: `useVideoPlayer` from `expo-video`, `AppState` from `react-native`.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/player/engine/usePlaybackEngine.test.tsx
// F10 lifecycle, F15 position reporting, S4, S11-S13, S20.
import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { usePlaybackEngine } from "../../../components/VideoPlayer/engine/usePlaybackEngine";
import { POSITION_REPORT_INTERVAL_MS, TIME_UPDATE_INTERVAL_MS } from "../../../components/VideoPlayer/constants";
import type { EngineOptions } from "../../../components/VideoPlayer/engine/types";
import type { VideoPlayerSource } from "../../../components/VideoPlayer/types";
import { createFakeVideoPlayer, type FakeVideoPlayer } from "../fakes/fakeVideoPlayer";

let fake: FakeVideoPlayer;
jest.mock("expo-video", () => ({
  useVideoPlayer: jest.fn(() => fake),
}));

const MP4: VideoPlayerSource = { url: "https://example.test/v.mp4", kind: "mp4", isLive: false };
const HLS: VideoPlayerSource = { url: "https://example.test/s.m3u8", kind: "hls", isLive: false };
const OPTIONS: EngineOptions = { autoplay: true, loop: false, mutedByDefault: false, timeUpdateIntervalMs: TIME_UPDATE_INTERVAL_MS };

type AppStateHandler = (state: string) => void;
let appStateHandlers: AppStateHandler[] = [];
const removeSpy = jest.fn();

function becomeReady(duration = 100) {
  fake.duration = duration;
  fake.status = "readyToPlay";
  fake.emit("statusChange", { status: "readyToPlay", oldStatus: "loading" });
}
function tick(seconds: number) {
  fake.currentTime = seconds;
  fake.emit("timeUpdate", { currentTime: seconds, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: seconds + 5 });
}

beforeEach(() => {
  jest.useFakeTimers();
  fake = createFakeVideoPlayer();
  appStateHandlers = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    appStateHandlers.push(handler as AppStateHandler);
    return { remove: removeSpy };
  });
  removeSpy.mockClear();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("usePlaybackEngine", () => {
  it("creates the player with a null source, sets the source once, and plays after ready", () => {
    const { useVideoPlayer } = jest.requireMock("expo-video") as { useVideoPlayer: jest.Mock };
    const { result } = renderHook(() => usePlaybackEngine(MP4, OPTIONS));
    expect(useVideoPlayer).toHaveBeenCalledWith(null);
    expect(fake.replaceCalls).toHaveLength(1);
    expect(result.current.snapshot.status).toBe("loading");
    act(() => becomeReady());
    expect(result.current.snapshot.status).toBe("playing");
  });

  it("re-render with the same URL does not replace the source", () => {
    const { rerender } = renderHook(({ src }: { src: VideoPlayerSource }) => usePlaybackEngine(src, OPTIONS), { initialProps: { src: MP4 } });
    rerender({ src: { ...MP4 } });
    expect(fake.replaceCalls).toHaveLength(1);
  });

  it("S4: URL change replaces once and reports the old position first", () => {
    const onPositionChange = jest.fn();
    const { rerender, result } = renderHook(
      ({ src }: { src: VideoPlayerSource }) => usePlaybackEngine(src, OPTIONS, { onPositionChange }),
      { initialProps: { src: MP4 } },
    );
    act(() => becomeReady());
    act(() => tick(20));
    onPositionChange.mockClear();
    rerender({ src: HLS });
    expect(onPositionChange).toHaveBeenCalledWith(20_000, 100_000);
    expect(fake.replaceCalls).toHaveLength(2);
    expect(result.current.snapshot.status).toBe("loading");
    expect(result.current.snapshot.positionMs).toBe(0);
  });

  it("F15: reports position every POSITION_REPORT_INTERVAL_MS of playback, on pause and on seek", () => {
    const onPositionChange = jest.fn();
    const { result } = renderHook(() => usePlaybackEngine(MP4, OPTIONS, { onPositionChange }));
    act(() => becomeReady());
    act(() => tick(1));
    expect(onPositionChange).toHaveBeenCalledTimes(1); // first report fired when playback started at position 0 (elapsed from -Infinity)
    act(() => tick(3));
    expect(onPositionChange).toHaveBeenCalledTimes(1);
    act(() => tick(1 + POSITION_REPORT_INTERVAL_MS / 1000));
    expect(onPositionChange).toHaveBeenCalledTimes(2);
    act(() => result.current.commands.pause());
    expect(onPositionChange).toHaveBeenCalledTimes(3);
    act(() => result.current.commands.seekTo(50_000));
    expect(onPositionChange).toHaveBeenLastCalledWith(50_000, 100_000);
  });

  it("does not report position for live sources", () => {
    const onPositionChange = jest.fn();
    renderHook(() => usePlaybackEngine({ ...HLS, isLive: true }, OPTIONS, { onPositionChange }));
    act(() => becomeReady(0));
    act(() => tick(10));
    act(() => tick(20));
    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("S13: AppState background pauses via the engine; active does not resume", () => {
    const { result } = renderHook(() => usePlaybackEngine(MP4, OPTIONS));
    act(() => becomeReady());
    act(() => appStateHandlers.forEach((h) => h("background")));
    expect(fake.pause).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot.status).toBe("paused");
    act(() => appStateHandlers.forEach((h) => h("active")));
    expect(result.current.snapshot.status).toBe("paused");
  });

  it("S11/S12/S20: unmount reports the final position, pauses, removes listeners and clears timers", () => {
    const onPositionChange = jest.fn();
    const { unmount } = renderHook(() => usePlaybackEngine(MP4, OPTIONS, { onPositionChange }));
    act(() => becomeReady());
    act(() => tick(7));
    onPositionChange.mockClear();
    unmount();
    expect(onPositionChange).toHaveBeenCalledWith(7_000, 100_000);
    expect(fake.pause).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(fake.listenerCount("timeUpdate")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("uses the latest onPositionChange callback (no stale closure)", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender, result } = renderHook(
      ({ cb }: { cb: (p: number, d: number) => void }) => usePlaybackEngine(MP4, OPTIONS, { onPositionChange: cb }),
      { initialProps: { cb: first } },
    );
    act(() => becomeReady());
    rerender({ cb: second });
    act(() => result.current.commands.pause());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("exposes notifyPictureInPicture", () => {
    const { result } = renderHook(() => usePlaybackEngine(MP4, OPTIONS));
    act(() => becomeReady());
    act(() => result.current.notifyPictureInPicture(true));
    expect(result.current.snapshot.isPictureInPicture).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern=engine/usePlaybackEngine`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/engine/usePlaybackEngine.ts
// React binding for PlaybackEngine. Owns the expo-video player instance,
// the AppState subscription and the onPositionChange cadence (E9).
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useVideoPlayer, type VideoPlayer } from "expo-video";
import { POSITION_REPORT_INTERVAL_MS } from "../constants";
import type { VideoPlayerSource } from "../types";
import { PlaybackEngine, type AppStateName } from "./PlaybackEngine";
import type { EngineOptions, PlaybackCommands, PlaybackSnapshot } from "./types";

export interface UsePlaybackEngineCallbacks {
  readonly onPositionChange?: (positionMs: number, durationMs: number) => void;
}

export interface UsePlaybackEngineResult {
  readonly snapshot: PlaybackSnapshot;
  readonly commands: PlaybackCommands;
  readonly player: VideoPlayer;
  readonly notifyPictureInPicture: (active: boolean) => void;
}

interface EngineStore {
  readonly engine: PlaybackEngine;
  subscribe(listener: () => void): () => void;
  getSnapshot(): PlaybackSnapshot;
}

function createStore(player: VideoPlayer, options: EngineOptions): EngineStore {
  const listeners = new Set<() => void>();
  let current: PlaybackSnapshot | null = null;
  const engine = new PlaybackEngine(player, options, (snapshot) => {
    current = snapshot;
    for (const listener of listeners) listener();
  });
  current = engine.getSnapshot();
  return {
    engine,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => current ?? engine.getSnapshot(),
  };
}

export function usePlaybackEngine(
  source: VideoPlayerSource,
  options: EngineOptions,
  callbacks: UsePlaybackEngineCallbacks = {},
): UsePlaybackEngineResult {
  const player = useVideoPlayer(null);
  const storeRef = useRef<EngineStore | null>(null);
  if (storeRef.current === null) storeRef.current = createStore(player, options);
  const store = storeRef.current;
  const { engine } = store;

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const lastReportedMsRef = useRef(Number.NEGATIVE_INFINITY);
  const prevStatusRef = useRef(snapshot.status);
  const lastUrlRef = useRef<string | null>(null);

  const report = useCallback(() => {
    const s = engine.getSnapshot();
    if (s.isLive) return;
    const cb = callbacksRef.current.onPositionChange;
    if (!cb) return;
    lastReportedMsRef.current = engine.lastKnownPositionMs;
    cb(engine.lastKnownPositionMs, s.durationMs);
  }, [engine]);

  // Source changes: one replace per URL change; report the old position first.
  useEffect(() => {
    if (lastUrlRef.current === source.url) return;
    if (lastUrlRef.current !== null) report();
    lastUrlRef.current = source.url;
    lastReportedMsRef.current = Number.NEGATIVE_INFINITY;
    engine.setSource(source);
  }, [engine, report, source]);

  // AppState and disposal.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => engine.notifyAppState(state as AppStateName));
    return () => {
      subscription.remove();
      report();
      engine.dispose();
    };
  }, [engine, report]);

  // Position cadence: every POSITION_REPORT_INTERVAL_MS while playing, and on pause/ended edges.
  useEffect(() => {
    const statusChanged = prevStatusRef.current !== snapshot.status;
    prevStatusRef.current = snapshot.status;
    if (snapshot.isLive) return;
    const due = snapshot.status === "playing" && snapshot.positionMs - lastReportedMsRef.current >= POSITION_REPORT_INTERVAL_MS;
    const edge = statusChanged && (snapshot.status === "paused" || snapshot.status === "ended");
    if (due || edge) report();
  }, [snapshot, report]);

  const commands = useMemo<PlaybackCommands>(
    () => ({
      ...engine.commands,
      seekTo: (positionMs) => {
        engine.commands.seekTo(positionMs);
        report();
      },
      seekBy: (deltaMs) => {
        engine.commands.seekBy(deltaMs);
        report();
      },
    }),
    [engine, report],
  );

  const notifyPictureInPicture = useCallback((active: boolean) => engine.notifyPictureInPicture(active), [engine]);

  return { snapshot, commands, player, notifyPictureInPicture };
}
```

- [ ] **Step 4: Run and type-check**

Run: `npm test -- --testPathPattern=engine/usePlaybackEngine`
Expected: 9 passed. If the F15 test's first assertion fails because the first `tick(1)` did not report, check that `lastReportedMsRef` starts at `-Infinity` (so `1000 - (-Infinity) >= 5000` is true).

Run: `npx tsc --noEmit 2>&1 | grep "components/VideoPlayer\|__tests__/player"`
Expected: no output. If `useVideoPlayer(null)` is rejected by the types, use `useVideoPlayer(null as VideoSource)` with `import type { VideoSource } from "expo-video"` — `VideoSource` includes `null`.

- [ ] **Step 5: Commit**

```bash
git add components/VideoPlayer/engine/usePlaybackEngine.ts __tests__/player/engine/usePlaybackEngine.test.tsx
git commit -m "feat(player): add usePlaybackEngine hook with AppState handling and position cadence

Verified: npm test -- --testPathPattern=engine/usePlaybackEngine => 9 passed
Verified: npx tsc --noEmit => no errors in components/VideoPlayer or __tests__/player

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Activate invariant R3, run the gate, write the report

**Files:**
- Modify: `__tests__/player/invariants.test.ts` (`ACTIVE_RULES`)
- Create: `docs/superpowers/plans/2026-09-16-video-player-02-report.md`
- Modify: `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §4.1 (add the `sourceLoaded` event to the `EngineEvent` list) — a documentation change to keep the spec aligned with the shipped type.

- [ ] **Step 1: Activate R3**

In `__tests__/player/invariants.test.ts` change:
```ts
const ACTIVE_RULES: readonly RuleId[] = ["R1", "R2", "R7", "OLD_ROOT_FROZEN"];
```
to:
```ts
const ACTIVE_RULES: readonly RuleId[] = ["R1", "R2", "R3", "R6", "R7", "OLD_ROOT_FROZEN"];
```
(R6 — no `any` — can be active now because `engine/` exists and contains none.)

Run: `npm test -- --testPathPattern=invariants`
Expected: 6 passed, 3 skipped.

- [ ] **Step 2: Align the spec's event list**

In `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §4.1, inside the `EngineEvent` union after the `sourceSet` line, add:
```ts
  | { type: "sourceLoaded"; durationMs: number; isLive: boolean }   // from expo-video sourceLoad (duration) and native isLive
```

- [ ] **Step 3: Run the full gate**

```bash
npm test 2>&1 | tail -6
npm run test:web 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | grep -c "error TS"
wc -l components/VideoPlayer/engine/*.ts components/VideoPlayer/*.ts
```
Expected: all suites pass; lint 0 errors (warnings not above the Increment 0 baseline); tsc error count equals the Increment 0 count (all pre-existing, none in the player); every file under its budget.

- [ ] **Step 4: Write the report**

Create `docs/superpowers/plans/2026-09-16-video-player-02-report.md`:

```markdown
# Increment 1 — Engine Report

Date: <date>  Branch: feature/player-1-engine

## Gate
- npm test: <N> suites, <N> tests passed (Increment 0: <N>)
- npm run test:web: <N> passed
- npm run lint: <N> errors, <N> warnings
- npx tsc --noEmit: <N> errors, none under components/VideoPlayer or __tests__/player
- invariants: R1, R2, R3, R6, R7, OLD_ROOT_FROZEN passing

## Coverage of the transition table
- Part A rows: <N>; Part B rows: <N>; field events: <N>; invariant loop: <statuses × events>

## Deviations and notes
- <e.g. expo-video payload types imported from build path; Reanimated mock note; anything that differed from the plan>

## Performance
Not applicable: no UI yet. P6 (timers after unmount) proven by usePlaybackEngine S20 test.

## Not done
- <none, or list>
```

- [ ] **Step 5: Commit**

```bash
git add __tests__/player/invariants.test.ts docs/superpowers/specs/2026-09-16-video-player-redesign-design.md docs/superpowers/plans/2026-09-16-video-player-02-report.md
git commit -m "test(player): activate R3/R6 invariants; align spec event list; Increment 1 report

Verified: npm test => <N> suites passed
Verified: npm run lint => 0 errors

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Increment 1 exit criteria (`docs/player/10-migration-and-swap.md` §1): §3.1 tests green, R3 active, reducer table fully covered. Merge to `main` after review; Increment 2 branches from `main`.
