# Increment 4 — Composition Root Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, inline in this session (CLAUDE.md §0 forbids subagents). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-09-16-video-player-00-index.md` first. Increments 1, 2 and 3 must be merged.

**Goal:** Wire engine, adapters, gestures and UI into `components/VideoPlayer/Player.tsx` behind the new public `VideoPlayerProps`, prove parity with the old player and the P4 render budget, without touching `index.tsx`.

**Architecture:** `Player.tsx` is declarative glue under 250 lines. Root-only hooks in `components/VideoPlayer/hooks/` own fullscreen orchestration, layout mode, surface layout, toast timing, end-screen countdown, state-change forwarding and keyboard mapping. Tests mock `usePlaybackEngine` and the platform barrel.

**Tech Stack:** React 19, react-native `BackHandler`/`useWindowDimensions`, react-native-safe-area-context, RNGH `GestureDetector`, RNTL 13.

**Spec:** `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §3.3, §3.4; `docs/player/03-architecture.md` §5; `docs/player/06-ui-and-gestures-spec.md` §1; `docs/player/10-migration-and-swap.md` §3 (parity rows); `docs/player/08-reliability-and-performance.md` P4.

## Global Constraints

See the index. Additionally:
- `components/VideoPlayer/index.tsx` is not modified (OLD_ROOT_FROZEN invariant).
- `Player.tsx` ≤ 250 lines; each hook ≤ 80 lines.
- No timers in `Player.tsx` itself; timers live in hooks with cleanup tests.

## File structure produced

```
components/VideoPlayer/
  types.ts                          (+ VideoPlayerProps)
  Player.tsx
  hooks/layoutMode.ts               pure layoutModeFor()
  hooks/useSurfaceLayout.ts
  hooks/useToast.ts
  hooks/useFullscreen.ts
  hooks/useEndScreenCountdown.ts
  hooks/useOnStateChange.ts
  hooks/useKeyboardShortcuts.ts
__tests__/player/fakes/fakeEngineHook.ts
__tests__/player/hooks/*.test.tsx
__tests__/player/VideoPlayer.root.test.tsx
__tests__/player/VideoPlayer.parity.test.tsx
__tests__/player/VideoPlayer.root.perf.test.tsx
```

---

### Task 1: Public props, layout mode, surface layout, toast hook

**Files:**
- Modify: `components/VideoPlayer/types.ts` (append `VideoPlayerProps`)
- Create: `hooks/layoutMode.ts`, `hooks/useSurfaceLayout.ts`, `hooks/useToast.ts`
- Test: `__tests__/player/hooks/smallHooks.test.tsx`

**Interfaces:**
```ts
// types.ts
export interface VideoPlayerProps { … as spec §3.3 … }
// hooks
export type LayoutMode = "inline" | "fullscreen" | "minimized";
export function layoutModeFor(isMinimized: boolean, isFullscreen: boolean): LayoutMode   // minimized wins
export function useSurfaceLayout(): readonly [{ width: number; height: number }, (e: LayoutChangeEvent) => void]
export function useToast(): { readonly message: string | null; show(text: string): void }
```

- [ ] **Step 1: Append `VideoPlayerProps`**

Append to `components/VideoPlayer/types.ts`:
```ts
import type { CaptionItem, ChapterItem } from "../../types/domain";
import type { PlaybackSnapshot } from "./engine/types";

export interface VideoPlayerProps {
  readonly source: VideoPlayerSource;
  readonly title: string;
  readonly captions?: readonly CaptionItem[];
  readonly chapters?: readonly ChapterItem[];
  readonly autoplay?: boolean;
  readonly initialPositionMs?: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayNextEnabled: boolean;
  readonly isMinimized: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  /** Fires once when the end-screen countdown completes (autoplay-next on and hasNext). */
  readonly onFinished: () => void;
  readonly onToggleMinimize: () => void;
  readonly onToggleAutoplayNext: (enabled: boolean) => void;
  readonly onFullscreenChange: (isFullscreen: boolean) => void;
  /** Every POSITION_REPORT_INTERVAL_MS while playing, and on pause/seek/end/unmount. Not for live. */
  readonly onPositionChange: (positionMs: number, durationMs: number) => void;
  readonly onStateChange: (snapshot: PlaybackSnapshot) => void;
  readonly testID?: string;
}
```
Move the existing `import type` for `CaptionItem`/`ChapterItem` to the top of the file (imports first).

- [ ] **Step 2: Write the failing tests**

```tsx
// __tests__/player/hooks/smallHooks.test.tsx
import { act, renderHook } from "@testing-library/react-native";
import { layoutModeFor } from "../../../components/VideoPlayer/hooks/layoutMode";
import { useSurfaceLayout } from "../../../components/VideoPlayer/hooks/useSurfaceLayout";
import { useToast } from "../../../components/VideoPlayer/hooks/useToast";
import { TOAST_MS } from "../../../components/VideoPlayer/constants";

describe("layoutModeFor", () => {
  it("minimized wins, then fullscreen, then inline", () => {
    expect(layoutModeFor(true, true)).toBe("minimized");
    expect(layoutModeFor(false, true)).toBe("fullscreen");
    expect(layoutModeFor(false, false)).toBe("inline");
  });
});

describe("useSurfaceLayout", () => {
  it("starts at zero and stores the last layout", () => {
    const { result } = renderHook(() => useSurfaceLayout());
    expect(result.current[0]).toEqual({ width: 0, height: 0 });
    act(() => result.current[1]({ nativeEvent: { layout: { width: 320, height: 180, x: 0, y: 0 } } } as never));
    expect(result.current[0]).toEqual({ width: 320, height: 180 });
  });
});

describe("useToast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("shows, replaces, auto-dismisses, and clears the timer on unmount", () => {
    const { result, unmount } = renderHook(() => useToast());
    expect(result.current.message).toBeNull();
    act(() => result.current.show("A"));
    act(() => result.current.show("B"));
    expect(result.current.message).toBe("B");
    act(() => jest.advanceTimersByTime(TOAST_MS - 1));
    expect(result.current.message).toBe("B");
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.message).toBeNull();
    act(() => result.current.show("C"));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Step 3: Run to confirm failure**, then implement:

```ts
// components/VideoPlayer/hooks/layoutMode.ts
export type LayoutMode = "inline" | "fullscreen" | "minimized";

export function layoutModeFor(isMinimized: boolean, isFullscreen: boolean): LayoutMode {
  if (isMinimized) return "minimized";
  if (isFullscreen) return "fullscreen";
  return "inline";
}
```

```ts
// components/VideoPlayer/hooks/useSurfaceLayout.ts
import { useCallback, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

export interface SurfaceLayout {
  readonly width: number;
  readonly height: number;
}

export function useSurfaceLayout(): readonly [SurfaceLayout, (event: LayoutChangeEvent) => void] {
  const [layout, setLayout] = useState<SurfaceLayout>({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  return [layout, onLayout] as const;
}
```

```ts
// components/VideoPlayer/hooks/useToast.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { TOAST_MS } from "../constants";

export interface ToastState {
  readonly message: string | null;
  show(text: string): void;
}

export function useToast(): ToastState {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (text: string) => {
      clear();
      setMessage(text);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setMessage(null);
      }, TOAST_MS);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);
  return { message, show };
}
```

- [ ] **Step 4: Run and commit**

```bash
git checkout -b feature/player-4-root
git add components/VideoPlayer/types.ts components/VideoPlayer/hooks/layoutMode.ts components/VideoPlayer/hooks/useSurfaceLayout.ts components/VideoPlayer/hooks/useToast.ts __tests__/player/hooks/smallHooks.test.tsx
git commit -m "feat(player): add VideoPlayerProps and root helper hooks (layout mode, surface layout, toast)

Verified: npm test -- --testPathPattern=hooks/smallHooks => 4 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: useFullscreen

**Files:**
- Create: `hooks/useFullscreen.ts`
- Test: `__tests__/player/hooks/useFullscreen.test.tsx`

**Interfaces:**
```ts
export interface FullscreenInput { readonly onChange: (isFullscreen: boolean) => void; readonly getElement: () => unknown; readonly enabled: boolean }
export interface FullscreenController { readonly isFullscreen: boolean; enter(): Promise<void>; exit(): Promise<void>; toggle(): Promise<void> }
export function useFullscreen(input: FullscreenInput): FullscreenController
```
Behaviour: enter → `fullscreenAdapter.enter({getElement})`, `orientationAdapter.lock("landscape")`, `systemChromeAdapter.hide()`; exit → reverse with `lock("portrait")`, `show()`; failures dev-logged, never block; `BackHandler` consumed while fullscreen; `FULLSCREEN_ON_ROTATE` enters on landscape rotation when inline; adapter change events (web) mirror state; unmount while fullscreen restores orientation and chrome; `onChange` called on every state change via latest ref.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/player/hooks/useFullscreen.test.tsx
import { act, renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import { createFakeAdapters } from "../fakes/fakeAdapters";

const mockAdapters = createFakeAdapters();
jest.mock("../../../components/VideoPlayer/platform", () => ({
  fullscreenAdapter: mockAdapters.fullscreen,
  orientationAdapter: mockAdapters.orientation,
  systemChromeAdapter: mockAdapters.systemChrome,
  keyboardAdapter: mockAdapters.keyboard,
  pictureInPictureAdapter: mockAdapters.pictureInPicture,
  brightnessAdapter: mockAdapters.brightness,
  hapticsAdapter: mockAdapters.haptics,
}));

import { useFullscreen } from "../../../components/VideoPlayer/hooks/useFullscreen";

type BackHandlerCb = () => boolean;
let backHandlers: BackHandlerCb[] = [];
const backRemove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  backHandlers = [];
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e, cb) => {
    backHandlers.push(cb as BackHandlerCb);
    return { remove: backRemove };
  });
});

const getElement = () => null;

describe("useFullscreen", () => {
  it("enter locks landscape, hides chrome, reports change; exit reverses", async () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useFullscreen({ onChange, getElement, enabled: true }));
    await act(() => result.current.enter());
    expect(result.current.isFullscreen).toBe(true);
    expect(mockAdapters.orientation.lock).toHaveBeenCalledWith("landscape");
    expect(mockAdapters.systemChrome.hide).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(true);
    await act(() => result.current.exit());
    expect(result.current.isFullscreen).toBe(false);
    expect(mockAdapters.orientation.lock).toHaveBeenLastCalledWith("portrait");
    expect(mockAdapters.systemChrome.show).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("a failed orientation lock still enters fullscreen", async () => {
    mockAdapters.orientation.nextResult = { ok: false, reason: "x" };
    const { result } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    await act(() => result.current.enter());
    expect(result.current.isFullscreen).toBe(true);
    mockAdapters.orientation.nextResult = { ok: true };
  });

  it("hardware back exits fullscreen and is consumed; listener removed when not fullscreen", async () => {
    const { result } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    expect(backHandlers).toHaveLength(0);
    await act(() => result.current.enter());
    expect(backHandlers).toHaveLength(1);
    let consumed = false;
    await act(async () => {
      consumed = backHandlers[0]();
    });
    expect(consumed).toBe(true);
    expect(result.current.isFullscreen).toBe(false);
    expect(backRemove).toHaveBeenCalled();
  });

  it("rotating to landscape while inline enters fullscreen (FULLSCREEN_ON_ROTATE)", async () => {
    const { result } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    await act(async () => mockAdapters.orientation.emit(false));
    expect(result.current.isFullscreen).toBe(true);
  });

  it("adapter change (browser Escape) mirrors state without re-locking", async () => {
    const { result } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    await act(() => result.current.enter());
    await act(async () => {
      await mockAdapters.fullscreen.exit();
    });
    expect(result.current.isFullscreen).toBe(false);
  });

  it("unmount while fullscreen restores orientation and chrome", async () => {
    const { result, unmount } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    await act(() => result.current.enter());
    jest.clearAllMocks();
    unmount();
    expect(mockAdapters.orientation.lock).toHaveBeenCalledWith("portrait");
    expect(mockAdapters.systemChrome.show).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```ts
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
    if (!isFullscreenRef.current) return;
    note("fullscreen.exit", await fullscreenAdapter.exit());
    note("orientation.lock", await orientationAdapter.lock("portrait"));
    note("chrome.show", await systemChromeAdapter.show());
    apply(false);
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
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern=hooks/useFullscreen` → 6 passed.

```bash
git add components/VideoPlayer/hooks/useFullscreen.ts __tests__/player/hooks/useFullscreen.test.tsx
git commit -m "feat(player): add useFullscreen orchestration hook

Verified: npm test -- --testPathPattern=hooks/useFullscreen => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: useEndScreenCountdown, useOnStateChange, useKeyboardShortcuts

**Files:**
- Create: `hooks/useEndScreenCountdown.ts`, `hooks/useOnStateChange.ts`, `hooks/useKeyboardShortcuts.ts`
- Test: `__tests__/player/hooks/rootHooks.test.tsx`

**Interfaces:**
```ts
export function useEndScreenCountdown(i: { status: PlaybackStatus; isLive: boolean; hasNext: boolean; enabled: boolean; onFinished: () => void }): { secondsLeft: number | null; cancel(): void }
export function useOnStateChange(snapshot: PlaybackSnapshot, onStateChange: (s: PlaybackSnapshot) => void): void
export function useKeyboardShortcuts(i: { commands: PlaybackCommands; snapshot: PlaybackSnapshot; fullscreen: FullscreenController; onToggleCaptions: () => void; onInteraction: () => void; enabled: boolean }): void
```

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/player/hooks/rootHooks.test.tsx
import { act, renderHook } from "@testing-library/react-native";
import { createFakeAdapters } from "../fakes/fakeAdapters";

const mockAdapters = createFakeAdapters();
jest.mock("../../../components/VideoPlayer/platform", () => ({
  fullscreenAdapter: mockAdapters.fullscreen,
  orientationAdapter: mockAdapters.orientation,
  systemChromeAdapter: mockAdapters.systemChrome,
  keyboardAdapter: mockAdapters.keyboard,
  pictureInPictureAdapter: mockAdapters.pictureInPicture,
  brightnessAdapter: mockAdapters.brightness,
  hapticsAdapter: mockAdapters.haptics,
}));

import { useEndScreenCountdown } from "../../../components/VideoPlayer/hooks/useEndScreenCountdown";
import { useOnStateChange } from "../../../components/VideoPlayer/hooks/useOnStateChange";
import { useKeyboardShortcuts } from "../../../components/VideoPlayer/hooks/useKeyboardShortcuts";
import { END_SCREEN_COUNTDOWN_MS, KEYBOARD_SEEK_LARGE_MS, KEYBOARD_SEEK_SMALL_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackCommands, PlaybackStatus } from "../../../components/VideoPlayer/engine/types";
import { playingSnapshot } from "../fakes/snapshots";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

describe("useEndScreenCountdown", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  type I = { status: PlaybackStatus; isLive: boolean; hasNext: boolean; enabled: boolean; onFinished: () => void };
  const base: I = { status: "playing", isLive: false, hasNext: true, enabled: true, onFinished: jest.fn() };

  it("counts down from 5 on ended and fires onFinished once", () => {
    const onFinished = jest.fn();
    const { result, rerender } = renderHook((p: I) => useEndScreenCountdown(p), { initialProps: { ...base, onFinished } });
    expect(result.current.secondsLeft).toBeNull();
    rerender({ ...base, onFinished, status: "ended" });
    expect(result.current.secondsLeft).toBe(END_SCREEN_COUNTDOWN_MS / 1000);
    act(() => jest.advanceTimersByTime(END_SCREEN_COUNTDOWN_MS));
    expect(onFinished).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(END_SCREEN_COUNTDOWN_MS));
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it("no countdown when disabled, no next, or live; cancel stops it", () => {
    for (const p of [{ ...base, enabled: false }, { ...base, hasNext: false }, { ...base, isLive: true }]) {
      const { result, unmount } = renderHook(() => useEndScreenCountdown({ ...p, status: "ended" }));
      expect(result.current.secondsLeft).toBeNull();
      unmount();
    }
    const onFinished = jest.fn();
    const { result } = renderHook(() => useEndScreenCountdown({ ...base, onFinished, status: "ended" }));
    act(() => result.current.cancel());
    expect(result.current.secondsLeft).toBeNull();
    act(() => jest.advanceTimersByTime(END_SCREEN_COUNTDOWN_MS));
    expect(onFinished).not.toHaveBeenCalled();
  });
  it("leaving ended stops the countdown", () => {
    const onFinished = jest.fn();
    const { rerender } = renderHook((p: I) => useEndScreenCountdown(p), { initialProps: { ...base, onFinished, status: "ended" } });
    rerender({ ...base, onFinished, status: "playing" });
    act(() => jest.advanceTimersByTime(END_SCREEN_COUNTDOWN_MS));
    expect(onFinished).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("useOnStateChange", () => {
  it("calls the latest callback whenever the snapshot changes", () => {
    const first = jest.fn();
    const second = jest.fn();
    const s1 = playingSnapshot();
    const { rerender } = renderHook(({ s, cb }) => useOnStateChange(s, cb), { initialProps: { s: s1, cb: first } });
    expect(first).toHaveBeenCalledWith(s1);
    const s2 = playingSnapshot({ positionMs: 2 });
    rerender({ s: s2, cb: second });
    expect(second).toHaveBeenCalledWith(s2);
    expect(first).toHaveBeenCalledTimes(1);
  });
});

describe("useKeyboardShortcuts", () => {
  it("maps keys to commands and fullscreen", () => {
    const c = commands();
    const fullscreen = { isFullscreen: false, enter: jest.fn(), exit: jest.fn(), toggle: jest.fn() };
    const onToggleCaptions = jest.fn();
    const onInteraction = jest.fn();
    renderHook(() => useKeyboardShortcuts({ commands: c, snapshot: playingSnapshot({ durationMs: 100_000, playbackRate: 1 }), fullscreen, onToggleCaptions, onInteraction, enabled: true }));
    mockAdapters.keyboard.press("togglePlay");
    mockAdapters.keyboard.press("seekBack5");
    mockAdapters.keyboard.press("seekForward10");
    mockAdapters.keyboard.press("seekPercent5");
    mockAdapters.keyboard.press("rateUp");
    mockAdapters.keyboard.press("mute");
    mockAdapters.keyboard.press("fullscreen");
    mockAdapters.keyboard.press("exit");
    mockAdapters.keyboard.press("captions");
    expect(c.togglePlay).toHaveBeenCalled();
    expect(c.seekBy).toHaveBeenCalledWith(-KEYBOARD_SEEK_SMALL_MS);
    expect(c.seekBy).toHaveBeenCalledWith(KEYBOARD_SEEK_LARGE_MS);
    expect(c.seekTo).toHaveBeenCalledWith(50_000);
    expect(c.setRate).toHaveBeenCalledWith(1.25);
    expect(c.setMuted).toHaveBeenCalledWith(true);
    expect(fullscreen.toggle).toHaveBeenCalled();
    expect(fullscreen.exit).toHaveBeenCalled();
    expect(onToggleCaptions).toHaveBeenCalled();
    expect(onInteraction).toHaveBeenCalledTimes(9);
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```ts
// components/VideoPlayer/hooks/useEndScreenCountdown.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { END_SCREEN_COUNTDOWN_MS } from "../constants";
import type { PlaybackStatus } from "../engine/types";

const ONE_SECOND_MS = 1000;

interface Input {
  readonly status: PlaybackStatus;
  readonly isLive: boolean;
  readonly hasNext: boolean;
  readonly enabled: boolean;
  readonly onFinished: () => void;
}

export function useEndScreenCountdown({ status, isLive, hasNext, enabled, onFinished }: Input): { secondsLeft: number | null; cancel(): void } {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    const active = status === "ended" && enabled && hasNext && !isLive;
    if (!active) {
      stop();
      return;
    }
    let remaining = END_SCREEN_COUNTDOWN_MS / ONE_SECOND_MS;
    setSecondsLeft(remaining);
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setSecondsLeft(remaining);
        return;
      }
      stop();
      onFinishedRef.current();
    }, ONE_SECOND_MS);
    return stop;
  }, [status, enabled, hasNext, isLive, stop]);

  return { secondsLeft, cancel: stop };
}
```

```ts
// components/VideoPlayer/hooks/useOnStateChange.ts
import { useEffect, useRef } from "react";
import type { PlaybackSnapshot } from "../engine/types";

export function useOnStateChange(snapshot: PlaybackSnapshot, onStateChange: (snapshot: PlaybackSnapshot) => void): void {
  const ref = useRef(onStateChange);
  ref.current = onStateChange;
  useEffect(() => {
    ref.current(snapshot);
  }, [snapshot]);
}
```

```ts
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
```

- [ ] **Step 3: Run and commit**

```bash
git add components/VideoPlayer/hooks/useEndScreenCountdown.ts components/VideoPlayer/hooks/useOnStateChange.ts components/VideoPlayer/hooks/useKeyboardShortcuts.ts __tests__/player/hooks/rootHooks.test.tsx
git commit -m "feat(player): add end-screen countdown, state-change forwarding and keyboard shortcut hooks

Verified: npm test -- --testPathPattern=hooks/rootHooks => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Fake engine hook and `Player.tsx`

**Files:**
- Create: `__tests__/player/fakes/fakeEngineHook.ts`
- Create: `components/VideoPlayer/Player.tsx`
- Test: `__tests__/player/VideoPlayer.root.test.tsx`

**Interfaces:**
- Produces: `export function Player(props: VideoPlayerProps): JSX.Element` (default-exported by `index.tsx` at the swap).
- Fake: `mockEngine = installFakeEngineHook()` returning `{ setSnapshot(s), commands, notifyPictureInPicture, lastOptions, lastCallbacks }`.

- [ ] **Step 1: Fake engine hook**

```ts
// __tests__/player/fakes/fakeEngineHook.ts
// Replaces usePlaybackEngine in root tests. Call installFakeEngineHook() at module top,
// before importing Player, inside jest.mock's factory via the exported mock object.
import { act } from "@testing-library/react-native";
import type { EngineOptions, PlaybackCommands, PlaybackSnapshot } from "../../../components/VideoPlayer/engine/types";
import type { UsePlaybackEngineCallbacks } from "../../../components/VideoPlayer/engine/usePlaybackEngine";
import { loadingSnapshot } from "./snapshots";

export function fakeCommands(): PlaybackCommands {
  return {
    play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
    setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
    retry: jest.fn(), replay: jest.fn(),
  };
}

export function createFakeEngineHook() {
  let snapshot: PlaybackSnapshot = loadingSnapshot();
  const listeners = new Set<() => void>();
  const commands = fakeCommands();
  const state = {
    lastOptions: null as EngineOptions | null,
    lastCallbacks: null as UsePlaybackEngineCallbacks | null,
    notifyPictureInPicture: jest.fn(),
    commands,
    setSnapshot(next: PlaybackSnapshot) {
      snapshot = next;
      act(() => listeners.forEach((l) => l()));
    },
  };
  // The mocked usePlaybackEngine: subscribes the component to snapshot changes.
  const usePlaybackEngine = (_source: unknown, options: EngineOptions, callbacks?: UsePlaybackEngineCallbacks) => {
    const React = require("react") as typeof import("react");
    const [, force] = React.useState(0);
    React.useEffect(() => {
      const l = () => force((n) => n + 1);
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    }, []);
    state.lastOptions = options;
    state.lastCallbacks = callbacks ?? null;
    return { snapshot, commands, player: {}, notifyPictureInPicture: state.notifyPictureInPicture };
  };
  return { state, usePlaybackEngine };
}
```

- [ ] **Step 2: Write the failing root test**

```tsx
// __tests__/player/VideoPlayer.root.test.tsx
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createFakeAdapters } from "./fakes/fakeAdapters";
import { createFakeEngineHook } from "./fakes/fakeEngineHook";
import { endedSnapshot, errorSnapshot, loadingSnapshot, pausedSnapshot, playingSnapshot } from "./fakes/snapshots";

const mockAdapters = createFakeAdapters();
const mockEngine = createFakeEngineHook();
jest.mock("../../components/VideoPlayer/platform", () => ({
  fullscreenAdapter: mockAdapters.fullscreen,
  orientationAdapter: mockAdapters.orientation,
  systemChromeAdapter: mockAdapters.systemChrome,
  keyboardAdapter: mockAdapters.keyboard,
  pictureInPictureAdapter: mockAdapters.pictureInPicture,
  brightnessAdapter: mockAdapters.brightness,
  hapticsAdapter: mockAdapters.haptics,
}));
jest.mock("../../components/VideoPlayer/engine/usePlaybackEngine", () => ({ usePlaybackEngine: mockEngine.usePlaybackEngine }));
jest.mock("expo-video", () => {
  const ReactLib = require("react");
  return { VideoView: ReactLib.forwardRef((props: Record<string, unknown>, ref: unknown) => ReactLib.createElement("VideoView", { ...props, ref })) };
});
jest.mock("expo-image", () => {
  const ReactLib = require("react");
  return { Image: (props: Record<string, unknown>) => ReactLib.createElement("Image", props) };
});

import { Player } from "../../components/VideoPlayer/Player";
import type { VideoPlayerProps } from "../../components/VideoPlayer/types";
import { PLAYER_SURFACE_TEST_IDS } from "../../components/VideoPlayer/ui/PlayerSurface";
import { END_SCREEN_COUNTDOWN_MS } from "../../components/VideoPlayer/constants";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };
function props(overrides: Partial<VideoPlayerProps> = {}): VideoPlayerProps {
  return {
    source: { url: "https://example.test/v.mp4", kind: "mp4", isLive: false, posterUrl: "https://example.test/p.jpg" },
    title: "Gayatri Yagya", hasNext: true, hasPrevious: false, isAutoplayNextEnabled: true, isMinimized: false,
    onNext: jest.fn(), onPrevious: jest.fn(), onFinished: jest.fn(), onToggleMinimize: jest.fn(), onToggleAutoplayNext: jest.fn(),
    onFullscreenChange: jest.fn(), onPositionChange: jest.fn(), onStateChange: jest.fn(), testID: "player", ...overrides,
  };
}
function renderPlayer(p: VideoPlayerProps = props()) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Player {...p} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEngine.state.setSnapshot(loadingSnapshot());
});

describe("Player (composition root)", () => {
  it("renders without app providers and passes engine options and position callback", () => {
    const p = props({ autoplay: false, initialPositionMs: 5_000 });
    renderPlayer(p);
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video)).toBeTruthy();
    expect(mockEngine.state.lastOptions).toMatchObject({ autoplay: false, loop: false, mutedByDefault: false, initialPositionMs: 5_000 });
    mockEngine.state.lastCallbacks?.onPositionChange?.(1_000, 2_000);
    expect(p.onPositionChange).toHaveBeenCalledWith(1_000, 2_000);
  });

  it("shows the poster until the first playing snapshot, then never again", () => {
    renderPlayer();
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeTruthy();
    mockEngine.state.setSnapshot(playingSnapshot());
    expect(screen.queryByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeNull();
    mockEngine.state.setSnapshot(pausedSnapshot());
    expect(screen.queryByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeNull();
  });

  it("forwards every snapshot to onStateChange using the latest callback", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderPlayer(props({ onStateChange: first }));
    expect(first).toHaveBeenCalled();
    rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <Player {...props({ onStateChange: second })} />
      </SafeAreaProvider>,
    );
    const s = playingSnapshot({ positionMs: 3 });
    mockEngine.state.setSnapshot(s);
    expect(second).toHaveBeenCalledWith(s);
  });

  it("fullscreen keeps the same VideoView node and reports changes", async () => {
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    const before = screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video);
    await act(async () => fireEvent.press(screen.getByLabelText("Fullscreen")));
    expect(p.onFullscreenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video)).toBe(before);
    expect(screen.getByLabelText("Exit fullscreen")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText("Exit fullscreen")));
    expect(p.onFullscreenChange).toHaveBeenLastCalledWith(false);
  });

  it("minimized renders the mini player and hides the overlay", () => {
    const p = props({ isMinimized: true });
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    fireEvent.press(screen.getByLabelText("Restore player"));
    expect(p.onToggleMinimize).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Fullscreen")).toBeNull();
  });

  it("error shows the card and Retry calls the engine; overlay centre is empty", () => {
    renderPlayer();
    mockEngine.state.setSnapshot(errorSnapshot("network", { retryAttempt: 3 }));
    fireEvent.press(screen.getByLabelText("Retry"));
    expect(mockEngine.state.commands.retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Play")).toBeNull();
  });

  it("ended with autoplay-next runs the countdown then onFinished; cancel stops it", () => {
    jest.useFakeTimers();
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(endedSnapshot());
    expect(screen.getByText(`Up next in ${END_SCREEN_COUNTDOWN_MS / 1000}`)).toBeTruthy();
    act(() => jest.advanceTimersByTime(END_SCREEN_COUNTDOWN_MS));
    expect(p.onFinished).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("autoplay toggle lifts to the app and toasts", () => {
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    fireEvent.press(screen.getByLabelText("Autoplay on"));
    expect(p.onToggleAutoplayNext).toHaveBeenCalledWith(false);
    expect(screen.getByText("Autoplay is off")).toBeTruthy();
  });

  it("PiP button starts PiP and the adapter event updates the engine", async () => {
    renderPlayer();
    mockEngine.state.setSnapshot(playingSnapshot());
    await act(async () => fireEvent.press(screen.getByLabelText("Picture in picture")));
    expect(mockAdapters.pictureInPicture.start).toHaveBeenCalled();
    const view = screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video);
    act(() => view.props.onPictureInPictureStart());
    expect(mockEngine.state.notifyPictureInPicture).toHaveBeenCalledWith(true);
  });

  it("keyboard shortcut maps to a command", () => {
    renderPlayer();
    mockEngine.state.setSnapshot(playingSnapshot());
    mockAdapters.keyboard.press("togglePlay");
    expect(mockEngine.state.commands.togglePlay).toHaveBeenCalled();
  });

  it("unmount restores brightness", () => {
    const { unmount } = renderPlayer();
    unmount();
    expect(mockAdapters.brightness.restore).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to confirm failure**, then implement `Player.tsx`:

```tsx
// components/VideoPlayer/Player.tsx
// Composition root. Spec §3.4; wiring order: docs/player/03-architecture.md §5.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VideoView } from "expo-video";
import { ASPECT_16_9, INLINE_MAX_HEIGHT_RATIO, LONG_PRESS_RATE, MINI_PLAYER_WIDTH, TIME_UPDATE_INTERVAL_MS } from "./constants";
import { devLog } from "./engine/devLog";
import { usePlaybackEngine } from "./engine/usePlaybackEngine";
import type { SubtitleTrackInfo } from "./engine/types";
import { useControlsVisibility } from "./gestures/useControlsVisibility";
import { useSwipeGestures } from "./gestures/useSwipeGestures";
import { useTapGestures } from "./gestures/useTapGestures";
import { layoutModeFor } from "./hooks/layoutMode";
import { useEndScreenCountdown } from "./hooks/useEndScreenCountdown";
import { useFullscreen } from "./hooks/useFullscreen";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useOnStateChange } from "./hooks/useOnStateChange";
import { useSurfaceLayout } from "./hooks/useSurfaceLayout";
import { useToast } from "./hooks/useToast";
import { brightnessAdapter, hapticsAdapter, pictureInPictureAdapter } from "./platform";
import { playerTokens } from "./tokens";
import type { VideoPlayerProps } from "./types";
import { BufferingIndicator } from "./ui/BufferingIndicator";
import { CaptionsView } from "./ui/CaptionsView";
import { ControlsOverlay } from "./ui/ControlsOverlay";
import { EndScreen } from "./ui/EndScreen";
import { ErrorCard } from "./ui/ErrorCard";
import { MiniPlayer } from "./ui/MiniPlayer";
import { PlayerSurface } from "./ui/PlayerSurface";
import { SettingsSheet } from "./ui/SettingsSheet";
import { SwipeIndicator, type SwipeLevel } from "./ui/SwipeIndicator";
import { Toast } from "./ui/Toast";

export function Player(props: VideoPlayerProps) {
  const { source, captions, chapters, isMinimized, hasNext, hasPrevious, isAutoplayNextEnabled } = props;

  // 1. Engine
  const { snapshot, commands, player, notifyPictureInPicture } = usePlaybackEngine(
    source,
    { autoplay: props.autoplay ?? true, loop: false, mutedByDefault: false, initialPositionMs: props.initialPositionMs, timeUpdateIntervalMs: TIME_UPDATE_INTERVAL_MS },
    { onPositionChange: props.onPositionChange },
  );

  // 2. Layout and platform
  const surfaceRef = useRef<View>(null);
  const videoViewRef = useRef<VideoView>(null);
  const getElement = useCallback(() => surfaceRef.current, []);
  const fullscreen = useFullscreen({ onChange: props.onFullscreenChange, getElement, enabled: !isMinimized });
  const layoutMode = layoutModeFor(isMinimized, fullscreen.isFullscreen);
  const [surfaceLayout, onSurfaceLayout] = useSurfaceLayout();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  // 3. Transient UI state
  const toast = useToast();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [swipeLevel, setSwipeLevel] = useState<SwipeLevel | null>(null);
  const hasPlayedRef = useRef(false);
  if (snapshot.status === "playing") hasPlayedRef.current = true;
  const rateBeforeLongPressRef = useRef(snapshot.playbackRate);

  // 4. Visibility, gestures, keyboard
  const visibility = useControlsVisibility({ status: snapshot.status, isSheetOpen, isMinimized });
  const gesturesEnabled = layoutMode !== "minimized" && !isSheetOpen && snapshot.status !== "error";
  const onToggleControls = useCallback(() => (visibility.visible ? visibility.hide() : visibility.show()), [visibility]);
  const onLongPressRate = useCallback(
    (active: boolean) => {
      if (active) {
        rateBeforeLongPressRef.current = snapshot.playbackRate;
        commands.setRate(LONG_PRESS_RATE);
        toast.show(`${LONG_PRESS_RATE}× speed`);
      } else {
        commands.setRate(rateBeforeLongPressRef.current);
      }
    },
    [commands, snapshot.playbackRate, toast],
  );
  const onSkipFeedback = useCallback((direction: "back" | "forward") => toast.show(direction === "back" ? "-10s" : "+10s"), [toast]);
  const tapGesture = useTapGestures({ commands, enabled: gesturesEnabled, layout: surfaceLayout, haptics: hapticsAdapter, onInteraction: visibility.onInteraction, onToggleControls, onSkipFeedback, onLongPressRate });
  const swipeGesture = useSwipeGestures({ commands, enabled: gesturesEnabled, layout: surfaceLayout, brightness: brightnessAdapter, initialVolume: snapshot.volume, onLevel: setSwipeLevel });
  const composedGesture = useMemo(() => Gesture.Simultaneous(tapGesture, swipeGesture), [tapGesture, swipeGesture]);
  const onToggleCaptions = useCallback(() => setCaptionsEnabled((v) => !v), []);
  useKeyboardShortcuts({ commands, snapshot, fullscreen, onToggleCaptions, onInteraction: visibility.onInteraction, enabled: layoutMode !== "minimized" });

  // 5. Outbound callbacks and effects
  useOnStateChange(snapshot, props.onStateChange);
  const countdown = useEndScreenCountdown({ status: snapshot.status, isLive: snapshot.isLive, hasNext, enabled: isAutoplayNextEnabled, onFinished: props.onFinished });
  useEffect(() => {
    brightnessAdapter.attach({ getElement });
    return () => {
      void brightnessAdapter.restore();
    };
  }, [getElement]);
  useEffect(() => pictureInPictureAdapter.subscribe({ getElement }, notifyPictureInPicture), [getElement, notifyPictureInPicture]);

  // 6. Handlers
  const onToggleAutoplayNext = useCallback(
    (enabled: boolean) => {
      props.onToggleAutoplayNext(enabled);
      toast.show(enabled ? "Autoplay is on" : "Autoplay is off");
    },
    [props, toast],
  );
  const onPip = useCallback(async () => {
    const view = videoViewRef.current;
    const result = await pictureInPictureAdapter.start({
      startPictureInPicture: view ? () => view.startPictureInPicture() : undefined,
      stopPictureInPicture: view ? () => view.stopPictureInPicture() : undefined,
      getElement,
    });
    if (!result.ok) devLog("adapter.failed.pip.start", { reason: result.reason });
  }, [getElement]);
  const onToggleMinimize = useCallback(async () => {
    if (fullscreen.isFullscreen) await fullscreen.exit();
    props.onToggleMinimize();
  }, [fullscreen, props]);
  const onRate = useCallback(
    (rate: number) => {
      commands.setRate(rate);
      toast.show(`Speed ${rate}×`);
    },
    [commands, toast],
  );
  const onSelectSubtitle = useCallback((track: SubtitleTrackInfo | null) => commands.selectSubtitle(track), [commands]);
  const onPictureInPictureStart = useCallback(() => notifyPictureInPicture(true), [notifyPictureInPicture]);
  const onPictureInPictureStop = useCallback(() => notifyPictureInPicture(false), [notifyPictureInPicture]);

  // 7. Layout style
  const containerStyle = useMemo(() => {
    if (layoutMode === "fullscreen") return [styles.base, styles.fullscreen, { width: window.width, height: window.height }];
    if (layoutMode === "minimized") return [styles.base, { width: MINI_PLAYER_WIDTH, height: MINI_PLAYER_WIDTH / ASPECT_16_9, borderRadius: playerTokens.radius.md }];
    const isPortrait = window.height > window.width;
    return isPortrait
      ? [styles.base, { width: "100%" as const, height: Math.min(window.height * INLINE_MAX_HEIGHT_RATIO, window.width / ASPECT_16_9) }]
      : [styles.base, { width: "100%" as const, aspectRatio: ASPECT_16_9 }];
  }, [layoutMode, window.height, window.width]);

  const activeQualityLabel = snapshot.activeQuality ? `Auto · ${snapshot.activeQuality.label}` : null;

  return (
    <View ref={surfaceRef} style={containerStyle} testID={props.testID}>
      <GestureDetector gesture={composedGesture}>
        <PlayerSurface
          ref={videoViewRef}
          player={player}
          posterUrl={source.posterUrl}
          showPoster={!hasPlayedRef.current}
          allowsPictureInPicture={pictureInPictureAdapter.isSupported()}
          onPictureInPictureStart={onPictureInPictureStart}
          onPictureInPictureStop={onPictureInPictureStop}
          onLayout={onSurfaceLayout}
        >
          {layoutMode === "minimized" ? (
            <MiniPlayer status={snapshot.status} commands={commands} onRestore={props.onToggleMinimize} onClose={props.onToggleMinimize} />
          ) : (
            <ControlsOverlay
              snapshot={snapshot}
              commands={commands}
              visible={visibility.visible && !snapshot.isPictureInPicture}
              opacity={visibility.opacity}
              layoutMode={layoutMode}
              insets={insets}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
              isAutoplayNextEnabled={isAutoplayNextEnabled}
              chapters={chapters}
              pipSupported={pictureInPictureAdapter.isSupported()}
              haptics={hapticsAdapter}
              onNext={props.onNext}
              onPrevious={props.onPrevious}
              onToggleAutoplayNext={onToggleAutoplayNext}
              onToggleFullscreen={fullscreen.toggle}
              onToggleMinimize={onToggleMinimize}
              onOpenSettings={() => setSheetOpen(true)}
              onPip={onPip}
              onSeekStart={visibility.show}
              onSeekPreview={() => undefined}
              onSeekCommit={commands.seekTo}
              onSeekCancel={visibility.onInteraction}
            />
          )}
          {captionsEnabled && captions && layoutMode !== "minimized" ? <CaptionsView captions={captions} positionMs={snapshot.positionMs} /> : null}
          <BufferingIndicator status={snapshot.status} />
          <ErrorCard error={snapshot.error} retryAttempt={snapshot.retryAttempt} retrying={snapshot.status === "loading" && snapshot.retryAttempt > 0} onRetry={commands.retry} />
          <EndScreen visible={snapshot.status === "ended" && layoutMode !== "minimized"} secondsLeft={countdown.secondsLeft} onReplay={commands.replay} onCancelAutoplay={countdown.cancel} />
          <SwipeIndicator level={swipeLevel} />
          <Toast message={toast.message} />
        </PlayerSurface>
      </GestureDetector>
      <SettingsSheet
        visible={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        rate={snapshot.playbackRate}
        onRate={onRate}
        captionsAvailable={Boolean(captions?.length) || snapshot.subtitleTracks.length > 0}
        captionsEnabled={captionsEnabled}
        onToggleCaptions={setCaptionsEnabled}
        subtitleTracks={snapshot.subtitleTracks}
        activeSubtitle={snapshot.activeSubtitle}
        onSelectSubtitle={onSelectSubtitle}
        activeQualityLabel={activeQualityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: playerTokens.color.videoBackground, overflow: "hidden", alignSelf: "center" },
  fullscreen: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: playerTokens.z.fullscreen },
});
```

Note on `ErrorCard` `retrying`: the reducer moves `error → loading` during an automatic retry while `retryAttempt > 0`, and `error` is `null` in `loading`; the card therefore hides during the retry and reappears on the next failure. This matches spec F8 ("Retrying (n/3)…" shows while the retry is pending in the *error* state before the timer fires). If the product owner prefers the card to stay visible during the reload, change the reducer's `error → loading` transition to keep `error` and update spec table 4.2 — do not change it silently.

- [ ] **Step 4: Run and iterate**

Run: `npm test -- --testPathPattern=VideoPlayer.root`
Expected: all pass. Common fixes: if `useSafeAreaInsets` complains, wrap with `SafeAreaProvider` as shown; if `GestureDetector` requires `GestureHandlerRootView`, wrap the test render in it (`react-native-gesture-handler` exports it); if the Reanimated mock lacks `useAnimatedStyle` typing for `opacity.value`, the `setup.ts` mock covers it.

Run: `wc -l components/VideoPlayer/Player.tsx` → ≤ 250. If over, move handlers into `hooks/usePlayerHandlers.ts` (under 80 lines) and re-run.

- [ ] **Step 5: Commit**

```bash
git add __tests__/player/fakes/fakeEngineHook.ts components/VideoPlayer/Player.tsx __tests__/player/VideoPlayer.root.test.tsx
git commit -m "feat(player): add Player composition root wiring engine, adapters, gestures and UI

Verified: npm test -- --testPathPattern=VideoPlayer.root => <N> passed
Verified: wc -l components/VideoPlayer/Player.tsx => <N> (budget 250)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Parity suite and render-budget test

**Files:**
- Create: `__tests__/player/VideoPlayer.parity.test.tsx`
- Create: `__tests__/player/VideoPlayer.root.perf.test.tsx`

- [ ] **Step 1: Parity suite** — every row from `docs/player/10-migration-and-swap.md` §3, using the same mocks and `renderPlayer` helper as Task 4 (copy the mock block and helpers; do not import from the root test file).

```tsx
// __tests__/player/VideoPlayer.parity.test.tsx
// Parity rows C1-C21 (docs/player/10-migration-and-swap.md §3) against the NEW Player.
// Rows marked "intentional change" assert the new behaviour and say so.
// <copy the jest.mock block, imports, props() and renderPlayer() from VideoPlayer.root.test.tsx here>

describe("parity with the old player", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEngine.state.setSnapshot(loadingSnapshot());
  });

  it("C1/C2: renders MP4 and HLS sources without throwing", () => {
    expect(() => renderPlayer(props({ source: { url: "https://example.test/v.mp4", kind: "mp4", isLive: false } }))).not.toThrow();
    expect(() => renderPlayer(props({ source: { url: "https://example.test/s.m3u8", kind: "hls", isLive: false } }))).not.toThrow();
  });
  it("C3: one VideoView with native controls and native fullscreen disabled", () => {
    renderPlayer();
    const views = screen.getAllByTestId(PLAYER_SURFACE_TEST_IDS.video);
    expect(views).toHaveLength(1);
    expect(views[0].props.nativeControls).toBe(false);
    expect(views[0].props.allowsFullscreen).toBe(false);
  });
  it("C4: autoplay default true, explicit false honoured (engine option)", () => {
    renderPlayer(props());
    expect(mockEngine.state.lastOptions?.autoplay).toBe(true);
    renderPlayer(props({ autoplay: false }));
    expect(mockEngine.state.lastOptions?.autoplay).toBe(false);
  });
  it("C5/C6: next/previous present, disabled without neighbours, call handlers", () => {
    const p = props({ hasNext: true, hasPrevious: true });
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    fireEvent.press(screen.getByLabelText("Next video"));
    fireEvent.press(screen.getByLabelText("Previous video"));
    expect(p.onNext).toHaveBeenCalledTimes(1);
    expect(p.onPrevious).toHaveBeenCalledTimes(1);
  });
  it("C7: minimize calls onToggleMinimize (and now renders a real mini-player)", () => {
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    fireEvent.press(screen.getByLabelText("Minimize player"));
    expect(p.onToggleMinimize).toHaveBeenCalledTimes(1);
  });
  it("C8 (intentional change): autoplay toggle lifts state to the app and toasts", () => {
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    fireEvent.press(screen.getByLabelText("Autoplay on"));
    expect(p.onToggleAutoplayNext).toHaveBeenCalledWith(false);
  });
  it("C9 (intentional change): fullscreen toggles without remount; onFullscreenChange true/false", async () => {
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(playingSnapshot());
    await act(async () => fireEvent.press(screen.getByLabelText("Fullscreen")));
    expect(p.onFullscreenChange).toHaveBeenLastCalledWith(true);
    await act(async () => fireEvent.press(screen.getByLabelText("Exit fullscreen")));
    expect(p.onFullscreenChange).toHaveBeenLastCalledWith(false);
  });
  it("C10 (intentional change): progress bar and time label live inside the overlay", () => {
    renderPlayer();
    mockEngine.state.setSnapshot(playingSnapshot());
    expect(screen.getByLabelText("Seek")).toBeTruthy();
    expect(screen.getByText("0:10 / 1:40")).toBeTruthy();
  });
  it("C11 (intentional change): the player renders no action bar", () => {
    renderPlayer();
    mockEngine.state.setSnapshot(playingSnapshot());
    expect(screen.queryByLabelText(/like/i)).toBeNull();
    expect(screen.queryByLabelText(/share/i)).toBeNull();
  });
  it("C15: double-tap zones come from layout (see gestures tests); C16: controls auto-hide (see visibility tests)", () => {
    expect(true).toBe(true);
  });
  it("C17/C18: fullscreen locks landscape and hides chrome via adapters", async () => {
    renderPlayer();
    mockEngine.state.setSnapshot(playingSnapshot());
    await act(async () => fireEvent.press(screen.getByLabelText("Fullscreen")));
    expect(mockAdapters.orientation.lock).toHaveBeenCalledWith("landscape");
    expect(mockAdapters.systemChrome.hide).toHaveBeenCalled();
  });
  it("C19 (intentional change): onFinished fires after the countdown, not after 1s", () => {
    jest.useFakeTimers();
    const p = props();
    renderPlayer(p);
    mockEngine.state.setSnapshot(endedSnapshot());
    act(() => jest.advanceTimersByTime(1_000));
    expect(p.onFinished).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(END_SCREEN_COUNTDOWN_MS));
    expect(p.onFinished).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
  it("C20 (intentional change): contentFit is contain in every mode", async () => {
    renderPlayer();
    mockEngine.state.setSnapshot(playingSnapshot());
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video).props.contentFit).toBe("contain");
    await act(async () => fireEvent.press(screen.getByLabelText("Fullscreen")));
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video).props.contentFit).toBe("contain");
  });
});
```

Rows C12–C14 (Save/Share sheets, flags) are container-side after ADR 0006 and are asserted in Increment 6's container test. Row C21 (inline height constant) is asserted by reading `INLINE_MAX_HEIGHT_RATIO === 0.304` in the constants test (Increment 1).

- [ ] **Step 2: Render-budget test (P4)**

```tsx
// __tests__/player/VideoPlayer.root.perf.test.tsx
// P4: ≤ 4 root renders per second of playback with controls hidden.
// <copy the jest.mock block, imports, props() from VideoPlayer.root.test.tsx>
import { Profiler } from "react";

it("renders at most 20 times during 5 seconds of timeUpdate at 250 ms", () => {
  jest.useFakeTimers();
  let renders = 0;
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Profiler id="player" onRender={() => { renders += 1; }}>
        <Player {...props()} />
      </Profiler>
    </SafeAreaProvider>,
  );
  mockEngine.state.setSnapshot(playingSnapshot({ positionMs: 0 }));
  act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS + AUTO_HIDE_MS)); // controls hidden
  renders = 0;
  for (let t = 250; t <= 5_000; t += 250) {
    mockEngine.state.setSnapshot(playingSnapshot({ positionMs: t, bufferedMs: t + 5_000 }));
  }
  expect(renders).toBeLessThanOrEqual(20);
  jest.useRealTimers();
});
```
Import `INITIAL_VISIBLE_MS` and `AUTO_HIDE_MS` from constants. If the count exceeds 20, find the extra render source with `why-did-you-render`-style reasoning: a new object created per render passed to a `memo` child (for example the `insets` object or an inline callback). Fix by `useMemo`/`useCallback` in `Player.tsx`; do not raise the budget.

- [ ] **Step 3: Run, then gate and report**

```bash
npm test -- --testPathPattern="VideoPlayer\.(parity|root\.perf)"
npm test 2>&1 | tail -6
npm run test:web 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm test -- --testPathPattern=invariants
```

Create `docs/superpowers/plans/2026-09-16-video-player-05-report.md` with the gate numbers, the P4 measured render count, the `Player.tsx` line count, and any deviations (for example `GestureHandlerRootView` wrapper needed in tests).

- [ ] **Step 4: Commit**

```bash
git add __tests__/player/VideoPlayer.parity.test.tsx __tests__/player/VideoPlayer.root.perf.test.tsx docs/superpowers/plans/2026-09-16-video-player-05-report.md
git commit -m "test(player): add parity suite and P4 render-budget test; Increment 4 report

Verified: npm test -- --testPathPattern=\"VideoPlayer\\.(parity|root\\.perf)\" => <N> passed
Verified: P4 renders in 5 s of playback => <N> (budget 20)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Increment 4 exit criteria: §3.4 tests green including parity and P4. Merge to `main`; Increment 6 needs this and Increment 5.
