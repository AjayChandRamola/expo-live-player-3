# Increment 3 — UI and Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, inline in this session (CLAUDE.md §0 forbids subagents). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-09-16-video-player-00-index.md` first. Increments 1 and 2 must be merged.

**Goal:** Build every presentational component and gesture hook of the new player under `components/VideoPlayer/ui/` and `gestures/`, driven only by `PlaybackSnapshot` values and `PlaybackCommands`, with Reanimated for motion and react-native-gesture-handler for input, fully tested.

**Architecture:** One button primitive (`ControlButton`); thin state-driven wrappers; `ControlsOverlay` positions everything; transient views (`BufferingIndicator`, `ErrorCard`, `EndScreen`, `Toast`, `SwipeIndicator`, `CaptionsView`); `SettingsSheet` and `MiniPlayer`; `PlayerSurface` wraps `VideoView`. Gesture hooks return composed RNGH gestures. No component calls a player method or reads `Platform.OS`.

**Tech Stack:** react-native-reanimated ~4.1.1, react-native-gesture-handler ~2.28.0, @expo/vector-icons (MaterialCommunityIcons), expo-image, react-native-safe-area-context 5.6.2, RNTL 13, `react-native-gesture-handler/jest-utils`.

**Spec:** `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §6; `docs/player/06-ui-and-gestures-spec.md` (all sections); `docs/player/02-feature-catalog.md` F4–F8, F11–F14, F16–F20, F23–F27; ADR 0003.

## Global Constraints

See the index. Additionally:
- Every pressable: `accessibilityRole`, state-aware `accessibilityLabel`, `accessibilityState`, ≥ 44 pt target (`hitSlop`).
- No `Animated` from `react-native`, no `react-native-paper` (R5, activated in Task 12).
- `memo` only on `ProgressBar`, `CaptionsView`, `ControlsOverlay`, `ControlButton` (the spec names these).
- Styles via `StyleSheet.create` at module scope from `playerTokens`; only animated styles inline.
- Every timer cleared on unmount; tests assert `jest.getTimerCount() === 0` where a timer exists.

## File structure produced

```
components/VideoPlayer/
  constants.ts                  (+ CONTROL_PRESS_SCALE, CONTROL_ICON_RATIO, PRESS_SPRING)
  gestures/useControlsVisibility.ts
  gestures/useTapGestures.ts
  gestures/useSwipeGestures.ts
  ui/controls/ControlButton.tsx
  ui/controls/{PlayPauseButton,SkipButton,FullscreenButton,MuteButton,AutoplayToggle,PipButton,SettingsButton,MinimizeButton,GoLiveButton,LiveBadge}.tsx
  ui/{ProgressBar,TimeLabel,CaptionsView,BufferingIndicator,Toast,SwipeIndicator,ErrorCard,EndScreen,SettingsSheet,PlayerSurface,MiniPlayer,ControlsOverlay}.tsx
__tests__/harness/setup.ts      (+ gesture-handler jestSetup)
__tests__/player/fakes/snapshots.ts
__tests__/player/ui/*.test.tsx, __tests__/player/gestures/*.test.tsx
```

---

### Task 1: Gesture-handler test setup, snapshot fixtures, controls-visibility hook

**Files:**
- Modify: `__tests__/harness/setup.ts` (append gesture-handler setup)
- Create: `__tests__/player/fakes/snapshots.ts`
- Create: `components/VideoPlayer/gestures/useControlsVisibility.ts`
- Test: `__tests__/player/gestures/useControlsVisibility.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface ControlsVisibilityInput { readonly status: PlaybackStatus; readonly isSheetOpen: boolean; readonly isMinimized: boolean }
  export interface ControlsVisibility { readonly visible: boolean; readonly opacity: SharedValue<number>; show(): void; hide(): void; onInteraction(): void }
  export function useControlsVisibility(input: ControlsVisibilityInput): ControlsVisibility
  ```
  and snapshot fixtures `playingSnapshot(o?)`, `pausedSnapshot`, `readySnapshot`, `loadingSnapshot`, `bufferingSnapshot`, `endedSnapshot`, `errorSnapshot(code?)`, `liveSnapshot(offsetMs?)`.

- [ ] **Step 1: Append to the harness setup**

Append to `__tests__/harness/setup.ts`:
```ts
// react-native-gesture-handler needs its Jest setup for GestureDetector and fireGestureHandler.
require("react-native-gesture-handler/jestSetup");
```
Run `npm test -- --testPathPattern=harness/setup` → still 3 passed.

- [ ] **Step 2: Snapshot fixtures**

```ts
// __tests__/player/fakes/snapshots.ts
import { createInitialSnapshot } from "../../../components/VideoPlayer/engine/initialSnapshot";
import { ERROR_MESSAGES } from "../../../components/VideoPlayer/constants";
import type { PlaybackErrorCode, PlaybackSnapshot } from "../../../components/VideoPlayer/engine/types";

type O = Partial<PlaybackSnapshot>;
const base: O = { positionMs: 10_000, durationMs: 100_000, bufferedMs: 30_000 };

export const loadingSnapshot = (o: O = {}) => createInitialSnapshot({ status: "loading", ...o });
export const readySnapshot = (o: O = {}) => createInitialSnapshot({ status: "ready", ...base, ...o });
export const playingSnapshot = (o: O = {}) => createInitialSnapshot({ status: "playing", ...base, ...o });
export const pausedSnapshot = (o: O = {}) => createInitialSnapshot({ status: "paused", ...base, ...o });
export const bufferingSnapshot = (o: O = {}) => createInitialSnapshot({ status: "buffering", ...base, ...o });
export const endedSnapshot = (o: O = {}) => createInitialSnapshot({ status: "ended", ...base, positionMs: 100_000, ...o });
export const errorSnapshot = (code: PlaybackErrorCode = "network", o: O = {}) =>
  createInitialSnapshot({
    status: "error",
    error: { code, message: ERROR_MESSAGES[code], retryable: code !== "unsupported" },
    ...o,
  });
export const liveSnapshot = (liveOffsetMs: number | null = 0, o: O = {}) =>
  createInitialSnapshot({ status: "playing", isLive: true, durationMs: 0, liveOffsetMs, ...o });
```

- [ ] **Step 3: Write the failing visibility test**

```tsx
// __tests__/player/gestures/useControlsVisibility.test.tsx
// Rules V1-V9: docs/player/06-ui-and-gestures-spec.md §3
import { act, renderHook } from "@testing-library/react-native";
import { useControlsVisibility } from "../../../components/VideoPlayer/gestures/useControlsVisibility";
import { AUTO_HIDE_MS, INITIAL_VISIBLE_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackStatus } from "../../../components/VideoPlayer/engine/types";

type Input = { status: PlaybackStatus; isSheetOpen: boolean; isMinimized: boolean };
const playing: Input = { status: "playing", isSheetOpen: false, isMinimized: false };

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("useControlsVisibility", () => {
  it("V1: visible on mount, hides after INITIAL_VISIBLE_MS while playing", () => {
    const { result } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS - 1));
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
    expect(result.current.opacity.value).toBe(0);
  });

  it("V2: interaction shows and restarts the AUTO_HIDE_MS timer", () => {
    const { result } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS));
    expect(result.current.visible).toBe(false);
    act(() => result.current.onInteraction());
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(AUTO_HIDE_MS - 1));
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it("V3/V4: stays visible while paused, buffering, ended, error, loading, ready", () => {
    for (const status of ["paused", "buffering", "ended", "error", "loading", "ready"] as const) {
      const { result, unmount } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: { ...playing, status } });
      act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS + AUTO_HIDE_MS));
      expect(result.current.visible).toBe(true);
      unmount();
    }
  });

  it("V4/V5: pause shows and cancels; resuming schedules the hide again", () => {
    const { result, rerender } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS));
    expect(result.current.visible).toBe(false);
    rerender({ ...playing, status: "paused" });
    expect(result.current.visible).toBe(true);
    rerender(playing);
    act(() => jest.advanceTimersByTime(AUTO_HIDE_MS));
    expect(result.current.visible).toBe(false);
  });

  it("V6: an open sheet forces visible; closing restarts the timer", () => {
    const { result, rerender } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    rerender({ ...playing, isSheetOpen: true });
    act(() => jest.advanceTimersByTime(INITIAL_VISIBLE_MS + AUTO_HIDE_MS));
    expect(result.current.visible).toBe(true);
    rerender(playing);
    act(() => jest.advanceTimersByTime(AUTO_HIDE_MS));
    expect(result.current.visible).toBe(false);
  });

  it("V7/V8: minimized clears timers; unmount leaves no timers", () => {
    const { rerender, unmount } = renderHook((p: Input) => useControlsVisibility(p), { initialProps: playing });
    rerender({ ...playing, isMinimized: true });
    expect(jest.getTimerCount()).toBe(0);
    rerender(playing);
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Step 4: Run to confirm failure**

Run: `npm test -- --testPathPattern=gestures/useControlsVisibility`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement**

```ts
// components/VideoPlayer/gestures/useControlsVisibility.ts
// Rules V1-V9: docs/player/06-ui-and-gestures-spec.md §3
import { useCallback, useEffect, useRef, useState } from "react";
import { runOnJS, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { AUTO_HIDE_MS, CONTROLS_FADE_MS, INITIAL_VISIBLE_MS } from "../constants";
import type { PlaybackStatus } from "../engine/types";

export interface ControlsVisibilityInput {
  readonly status: PlaybackStatus;
  readonly isSheetOpen: boolean;
  readonly isMinimized: boolean;
}

export interface ControlsVisibility {
  readonly visible: boolean;
  readonly opacity: SharedValue<number>;
  show(): void;
  hide(): void;
  onInteraction(): void;
}

export function useControlsVisibility({ status, isSheetOpen, isMinimized }: ControlsVisibilityInput): ControlsVisibility {
  const [visible, setVisible] = useState(true);
  const opacity = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstScheduleRef = useRef(true);
  const statusRef = useRef(status);
  const sheetRef = useRef(isSheetOpen);
  statusRef.current = status;
  sheetRef.current = isSheetOpen;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    opacity.value = withTiming(0, { duration: CONTROLS_FADE_MS }, (finished) => {
      if (finished) runOnJS(setVisible)(false);
    });
  }, [clearTimer, opacity]);

  const show = useCallback(() => {
    setVisible(true);
    opacity.value = withTiming(1, { duration: CONTROLS_FADE_MS });
  }, [opacity]);

  const schedule = useCallback(
    (delayMs: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (statusRef.current === "playing" && !sheetRef.current) hide();
      }, delayMs);
    },
    [clearTimer, hide],
  );

  const onInteraction = useCallback(() => {
    show();
    if (statusRef.current === "playing" && !sheetRef.current) schedule(AUTO_HIDE_MS);
  }, [show, schedule]);

  // V1, V4, V5, V7
  useEffect(() => {
    if (isMinimized) {
      clearTimer();
      return;
    }
    if (status === "playing" && !isSheetOpen) {
      schedule(firstScheduleRef.current ? INITIAL_VISIBLE_MS : AUTO_HIDE_MS);
      firstScheduleRef.current = false;
      return;
    }
    show();
    clearTimer();
  }, [status, isSheetOpen, isMinimized, schedule, show, clearTimer]);

  // V8
  useEffect(() => clearTimer, [clearTimer]);

  return { visible, opacity, show, hide, onInteraction };
}
```

- [ ] **Step 6: Run and commit**

Run: `npm test -- --testPathPattern=gestures/useControlsVisibility` → 6 passed.

```bash
git checkout -b feature/player-3-ui
git add __tests__/harness/setup.ts __tests__/player/fakes/snapshots.ts components/VideoPlayer/gestures/useControlsVisibility.ts __tests__/player/gestures/useControlsVisibility.test.tsx
git commit -m "feat(player): add controls visibility hook and snapshot fixtures

Verified: npm test -- --testPathPattern=gestures/useControlsVisibility => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: ControlButton primitive

**Files:**
- Modify: `components/VideoPlayer/constants.ts` (append three constants)
- Create: `components/VideoPlayer/ui/controls/ControlButton.tsx`
- Test: `__tests__/player/ui/ControlButton.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type ControlSize = "sm" | "md" | "lg";
  export type ControlIcon = keyof typeof MaterialCommunityIcons.glyphMap;
  export interface ControlButtonProps { readonly icon: ControlIcon; readonly accessibilityLabel: string; readonly onPress: () => void; readonly size?: ControlSize; readonly disabled?: boolean; readonly active?: boolean; readonly testID?: string }
  export const ControlButton: React.MemoExoticComponent<(props: ControlButtonProps) => JSX.Element>
  ```

- [ ] **Step 1: Append constants**

Append to `components/VideoPlayer/constants.ts` under `// ---- Transient UI ----`:
```ts
export const CONTROL_PRESS_SCALE = 0.9;
export const CONTROL_ICON_RATIO = 0.6;
export const PRESS_SPRING = { damping: 15, stiffness: 300 } as const;
```

- [ ] **Step 2: Write the failing test**

```tsx
// __tests__/player/ui/ControlButton.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ControlButton } from "../../../components/VideoPlayer/ui/controls/ControlButton";
import { playerTokens } from "../../../components/VideoPlayer/tokens";

describe("ControlButton", () => {
  it("renders role, label and calls onPress once", () => {
    const onPress = jest.fn();
    render(<ControlButton icon="play" accessibilityLabel="Play" onPress={onPress} testID="btn" />);
    const btn = screen.getByRole("button", { name: "Play" });
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled and exposes the state", () => {
    const onPress = jest.fn();
    render(<ControlButton icon="play" accessibilityLabel="Play" onPress={onPress} disabled testID="btn" />);
    fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId("btn").props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("exposes selected state for toggles", () => {
    render(<ControlButton icon="play" accessibilityLabel="Autoplay on" onPress={jest.fn()} active testID="btn" />);
    expect(screen.getByTestId("btn").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("small buttons get hitSlop so the target is at least the minimum touch size", () => {
    render(<ControlButton icon="play" accessibilityLabel="Play" onPress={jest.fn()} size="sm" testID="btn" />);
    const expected = (playerTokens.size.minTouchTarget - playerTokens.size.controlSm) / 2;
    expect(screen.getByTestId("btn").props.hitSlop).toBe(expected);
  });

  it("medium and large buttons need no hitSlop", () => {
    render(<ControlButton icon="play" accessibilityLabel="Play" onPress={jest.fn()} size="lg" testID="btn" />);
    expect(screen.getByTestId("btn").props.hitSlop).toBe(0);
  });
});
```

- [ ] **Step 3: Run to confirm failure**, then implement:

```tsx
// components/VideoPlayer/ui/controls/ControlButton.tsx
// The one pressable primitive for every player control. Spec: 06 §5.1
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { CONTROL_ICON_RATIO, CONTROL_PRESS_SCALE, PRESS_SPRING } from "../../constants";
import { playerTokens } from "../../tokens";

export type ControlSize = "sm" | "md" | "lg";
export type ControlIcon = keyof typeof MaterialCommunityIcons.glyphMap;

export interface ControlButtonProps {
  readonly icon: ControlIcon;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly size?: ControlSize;
  readonly disabled?: boolean;
  readonly active?: boolean;
  readonly testID?: string;
}

const SIZE_PX: Readonly<Record<ControlSize, number>> = {
  sm: playerTokens.size.controlSm,
  md: playerTokens.size.controlMd,
  lg: playerTokens.size.controlLg,
};

export const ControlButton = memo(function ControlButton({
  icon,
  accessibilityLabel,
  onPress,
  size = "md",
  disabled = false,
  active = false,
  testID,
}: ControlButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const px = SIZE_PX[size];
  const hitSlop = Math.max(0, (playerTokens.size.minTouchTarget - px) / 2);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(CONTROL_PRESS_SCALE, PRESS_SPRING);
  }, [scale]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      testID={testID}
      style={[styles.base, { width: px, height: px, borderRadius: px / 2 }, disabled && styles.disabled]}
    >
      <Animated.View style={animatedStyle}>
        <MaterialCommunityIcons name={icon} size={Math.round(px * CONTROL_ICON_RATIO)} color={playerTokens.color.onVideo} />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", backgroundColor: playerTokens.color.scrim },
  disabled: { opacity: playerTokens.opacity.disabled },
});
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern=ui/ControlButton` → 5 passed. If `getByRole("button", { name })` fails to find by name, use `getByLabelText("Play")`.

```bash
git add components/VideoPlayer/constants.ts components/VideoPlayer/ui/controls/ControlButton.tsx __tests__/player/ui/ControlButton.test.tsx
git commit -m "feat(player): add ControlButton primitive with Reanimated press feedback

Verified: npm test -- --testPathPattern=ui/ControlButton => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: State-driven buttons and the live badge

**Files:**
- Create: `ui/controls/PlayPauseButton.tsx`, `SkipButton.tsx`, `FullscreenButton.tsx`, `MuteButton.tsx`, `AutoplayToggle.tsx`, `PipButton.tsx`, `SettingsButton.tsx`, `MinimizeButton.tsx`, `GoLiveButton.tsx`, `LiveBadge.tsx`
- Test: `__tests__/player/ui/PlayPauseButton.test.tsx`, `__tests__/player/ui/SkipButton.test.tsx`, `__tests__/player/ui/controls.test.tsx` (the remaining eight)

**Interfaces (all exported as named function components):**
```ts
PlayPauseButton({ status: PlaybackStatus; commands: PlaybackCommands; size?: ControlSize; testID?: string })
SkipButton({ direction: "previous" | "next"; enabled: boolean; onPress: () => void; size?: ControlSize; testID?: string })
FullscreenButton({ isFullscreen: boolean; onToggle: () => void; testID?: string })
MuteButton({ muted: boolean; commands: PlaybackCommands; testID?: string })
AutoplayToggle({ enabled: boolean; hasNext: boolean; onToggle: (enabled: boolean) => void; testID?: string })
PipButton({ supported: boolean; onPress: () => void; testID?: string })            // renders null when !supported
SettingsButton({ onPress: () => void; testID?: string })
MinimizeButton({ onPress: () => void; testID?: string })
GoLiveButton({ isLive: boolean; liveOffsetMs: number | null; commands: PlaybackCommands; testID?: string })  // renders null unless behind the edge
LiveBadge({ isLive: boolean; testID?: string })                                     // renders null when !isLive
```

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/player/ui/PlayPauseButton.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PlayPauseButton } from "../../../components/VideoPlayer/ui/controls/PlayPauseButton";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

function commands(): PlaybackCommands {
  return {
    play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
    setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
    retry: jest.fn(), replay: jest.fn(),
  };
}

describe("PlayPauseButton", () => {
  it("playing → Pause label, calls togglePlay", () => {
    const c = commands();
    render(<PlayPauseButton status="playing" commands={c} testID="pp" />);
    fireEvent.press(screen.getByLabelText("Pause"));
    expect(c.togglePlay).toHaveBeenCalledTimes(1);
  });
  it("paused and ready → Play label", () => {
    const c = commands();
    render(<PlayPauseButton status="paused" commands={c} />);
    expect(screen.getByLabelText("Play")).toBeTruthy();
  });
  it("ended → Replay label, calls replay", () => {
    const c = commands();
    render(<PlayPauseButton status="ended" commands={c} />);
    fireEvent.press(screen.getByLabelText("Replay"));
    expect(c.replay).toHaveBeenCalledTimes(1);
    expect(c.togglePlay).not.toHaveBeenCalled();
  });
  it.each(["loading", "buffering", "error", "idle"] as const)("%s → hidden", (status) => {
    render(<PlayPauseButton status={status} commands={commands()} testID="pp" />);
    expect(screen.queryByTestId("pp")).toBeNull();
  });
  it("twenty presses forward twenty commands", () => {
    const c = commands();
    render(<PlayPauseButton status="playing" commands={c} />);
    const btn = screen.getByLabelText("Pause");
    for (let i = 0; i < 20; i += 1) fireEvent.press(btn);
    expect(c.togglePlay).toHaveBeenCalledTimes(20);
  });
});
```

```tsx
// __tests__/player/ui/SkipButton.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SkipButton } from "../../../components/VideoPlayer/ui/controls/SkipButton";

describe("SkipButton", () => {
  it("previous/next labels and presses", () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    render(
      <>
        <SkipButton direction="previous" enabled onPress={onPrev} />
        <SkipButton direction="next" enabled onPress={onNext} />
      </>,
    );
    fireEvent.press(screen.getByLabelText("Previous video"));
    fireEvent.press(screen.getByLabelText("Next video"));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
  it("disabled when not enabled", () => {
    const onNext = jest.fn();
    render(<SkipButton direction="next" enabled={false} onPress={onNext} testID="next" />);
    fireEvent.press(screen.getByTestId("next"));
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByTestId("next").props.accessibilityState.disabled).toBe(true);
  });
});
```

```tsx
// __tests__/player/ui/controls.test.tsx
// FullscreenButton, MuteButton, AutoplayToggle, PipButton, SettingsButton, MinimizeButton, GoLiveButton, LiveBadge
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FullscreenButton } from "../../../components/VideoPlayer/ui/controls/FullscreenButton";
import { MuteButton } from "../../../components/VideoPlayer/ui/controls/MuteButton";
import { AutoplayToggle } from "../../../components/VideoPlayer/ui/controls/AutoplayToggle";
import { PipButton } from "../../../components/VideoPlayer/ui/controls/PipButton";
import { SettingsButton } from "../../../components/VideoPlayer/ui/controls/SettingsButton";
import { MinimizeButton } from "../../../components/VideoPlayer/ui/controls/MinimizeButton";
import { GoLiveButton } from "../../../components/VideoPlayer/ui/controls/GoLiveButton";
import { LiveBadge } from "../../../components/VideoPlayer/ui/controls/LiveBadge";
import { LIVE_EDGE_TOLERANCE_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

describe("FullscreenButton", () => {
  it("labels follow state and press toggles", () => {
    const onToggle = jest.fn();
    const { rerender } = render(<FullscreenButton isFullscreen={false} onToggle={onToggle} />);
    fireEvent.press(screen.getByLabelText("Fullscreen"));
    rerender(<FullscreenButton isFullscreen onToggle={onToggle} />);
    fireEvent.press(screen.getByLabelText("Exit fullscreen"));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

describe("MuteButton", () => {
  it("Mute when unmuted → setMuted(true); Unmute when muted → setMuted(false)", () => {
    const c = commands();
    const { rerender } = render(<MuteButton muted={false} commands={c} />);
    fireEvent.press(screen.getByLabelText("Mute"));
    expect(c.setMuted).toHaveBeenLastCalledWith(true);
    rerender(<MuteButton muted commands={c} />);
    fireEvent.press(screen.getByLabelText("Unmute"));
    expect(c.setMuted).toHaveBeenLastCalledWith(false);
  });
});

describe("AutoplayToggle", () => {
  it("toggles with the inverse value and reflects selected state", () => {
    const onToggle = jest.fn();
    render(<AutoplayToggle enabled hasNext onToggle={onToggle} testID="ap" />);
    fireEvent.press(screen.getByLabelText("Autoplay on"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("ap").props.accessibilityState.selected).toBe(true);
  });
  it("disabled without a next video", () => {
    const onToggle = jest.fn();
    render(<AutoplayToggle enabled={false} hasNext={false} onToggle={onToggle} testID="ap" />);
    fireEvent.press(screen.getByTestId("ap"));
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Autoplay off")).toBeTruthy();
  });
});

describe("PipButton", () => {
  it("hidden when unsupported; presses when supported", () => {
    const onPress = jest.fn();
    const { rerender } = render(<PipButton supported={false} onPress={onPress} testID="pip" />);
    expect(screen.queryByTestId("pip")).toBeNull();
    rerender(<PipButton supported onPress={onPress} testID="pip" />);
    fireEvent.press(screen.getByLabelText("Picture in picture"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsButton and MinimizeButton", () => {
  it("press callbacks and labels", () => {
    const onSettings = jest.fn();
    const onMinimize = jest.fn();
    render(
      <>
        <SettingsButton onPress={onSettings} />
        <MinimizeButton onPress={onMinimize} />
      </>,
    );
    fireEvent.press(screen.getByLabelText("Settings"));
    fireEvent.press(screen.getByLabelText("Minimize player"));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });
});

describe("GoLiveButton", () => {
  it("hidden for VOD and when at the live edge; visible behind the edge and calls goToLive", () => {
    const c = commands();
    const { rerender } = render(<GoLiveButton isLive={false} liveOffsetMs={null} commands={c} testID="gl" />);
    expect(screen.queryByTestId("gl")).toBeNull();
    rerender(<GoLiveButton isLive liveOffsetMs={LIVE_EDGE_TOLERANCE_MS} commands={c} testID="gl" />);
    expect(screen.queryByTestId("gl")).toBeNull();
    rerender(<GoLiveButton isLive liveOffsetMs={LIVE_EDGE_TOLERANCE_MS + 1} commands={c} testID="gl" />);
    fireEvent.press(screen.getByLabelText("Go live"));
    expect(c.goToLive).toHaveBeenCalledTimes(1);
  });
});

describe("LiveBadge", () => {
  it("renders only when live, with text and label", () => {
    const { rerender } = render(<LiveBadge isLive={false} testID="lb" />);
    expect(screen.queryByTestId("lb")).toBeNull();
    rerender(<LiveBadge isLive testID="lb" />);
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.getByLabelText("Live")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement each file:

```tsx
// components/VideoPlayer/ui/controls/PlayPauseButton.tsx
import React from "react";
import type { PlaybackCommands, PlaybackStatus } from "../../engine/types";
import { ControlButton, type ControlSize } from "./ControlButton";

interface Props {
  readonly status: PlaybackStatus;
  readonly commands: PlaybackCommands;
  readonly size?: ControlSize;
  readonly testID?: string;
}

export function PlayPauseButton({ status, commands, size = "lg", testID }: Props) {
  switch (status) {
    case "playing":
      return <ControlButton icon="pause" accessibilityLabel="Pause" onPress={commands.togglePlay} size={size} testID={testID} />;
    case "paused":
    case "ready":
      return <ControlButton icon="play" accessibilityLabel="Play" onPress={commands.togglePlay} size={size} testID={testID} />;
    case "ended":
      return <ControlButton icon="replay" accessibilityLabel="Replay" onPress={commands.replay} size={size} testID={testID} />;
    default:
      return null;
  }
}
```

```tsx
// components/VideoPlayer/ui/controls/SkipButton.tsx
import React from "react";
import { ControlButton, type ControlSize } from "./ControlButton";

interface Props {
  readonly direction: "previous" | "next";
  readonly enabled: boolean;
  readonly onPress: () => void;
  readonly size?: ControlSize;
  readonly testID?: string;
}

export function SkipButton({ direction, enabled, onPress, size = "md", testID }: Props) {
  const isPrevious = direction === "previous";
  return (
    <ControlButton
      icon={isPrevious ? "skip-previous" : "skip-next"}
      accessibilityLabel={isPrevious ? "Previous video" : "Next video"}
      onPress={onPress}
      disabled={!enabled}
      size={size}
      testID={testID}
    />
  );
}
```

```tsx
// components/VideoPlayer/ui/controls/FullscreenButton.tsx
import React from "react";
import { ControlButton } from "./ControlButton";

interface Props {
  readonly isFullscreen: boolean;
  readonly onToggle: () => void;
  readonly testID?: string;
}

export function FullscreenButton({ isFullscreen, onToggle, testID }: Props) {
  return (
    <ControlButton
      icon={isFullscreen ? "fullscreen-exit" : "fullscreen"}
      accessibilityLabel={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      onPress={onToggle}
      size="sm"
      testID={testID}
    />
  );
}
```

```tsx
// components/VideoPlayer/ui/controls/MuteButton.tsx
import React, { useCallback } from "react";
import type { PlaybackCommands } from "../../engine/types";
import { ControlButton } from "./ControlButton";

interface Props {
  readonly muted: boolean;
  readonly commands: PlaybackCommands;
  readonly testID?: string;
}

export function MuteButton({ muted, commands, testID }: Props) {
  const onPress = useCallback(() => commands.setMuted(!muted), [commands, muted]);
  return (
    <ControlButton
      icon={muted ? "volume-off" : "volume-high"}
      accessibilityLabel={muted ? "Unmute" : "Mute"}
      onPress={onPress}
      size="sm"
      testID={testID}
    />
  );
}
```

```tsx
// components/VideoPlayer/ui/controls/AutoplayToggle.tsx
import React, { useCallback } from "react";
import { ControlButton } from "./ControlButton";

interface Props {
  readonly enabled: boolean;
  readonly hasNext: boolean;
  readonly onToggle: (enabled: boolean) => void;
  readonly testID?: string;
}

export function AutoplayToggle({ enabled, hasNext, onToggle, testID }: Props) {
  const onPress = useCallback(() => onToggle(!enabled), [enabled, onToggle]);
  return (
    <ControlButton
      icon="play-circle-outline"
      accessibilityLabel={enabled ? "Autoplay on" : "Autoplay off"}
      onPress={onPress}
      active={enabled}
      disabled={!hasNext}
      size="sm"
      testID={testID}
    />
  );
}
```

```tsx
// components/VideoPlayer/ui/controls/PipButton.tsx
import React from "react";
import { ControlButton } from "./ControlButton";

interface Props {
  readonly supported: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function PipButton({ supported, onPress, testID }: Props) {
  if (!supported) return null;
  return <ControlButton icon="picture-in-picture-bottom-right" accessibilityLabel="Picture in picture" onPress={onPress} size="sm" testID={testID} />;
}
```

```tsx
// components/VideoPlayer/ui/controls/SettingsButton.tsx
import React from "react";
import { ControlButton } from "./ControlButton";

export function SettingsButton({ onPress, testID }: { readonly onPress: () => void; readonly testID?: string }) {
  return <ControlButton icon="cog-outline" accessibilityLabel="Settings" onPress={onPress} size="sm" testID={testID} />;
}
```

```tsx
// components/VideoPlayer/ui/controls/MinimizeButton.tsx
import React from "react";
import { ControlButton } from "./ControlButton";

export function MinimizeButton({ onPress, testID }: { readonly onPress: () => void; readonly testID?: string }) {
  return <ControlButton icon="arrow-collapse" accessibilityLabel="Minimize player" onPress={onPress} size="sm" testID={testID} />;
}
```

```tsx
// components/VideoPlayer/ui/controls/GoLiveButton.tsx
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { LIVE_EDGE_TOLERANCE_MS } from "../../constants";
import type { PlaybackCommands } from "../../engine/types";
import { playerTokens } from "../../tokens";

interface Props {
  readonly isLive: boolean;
  readonly liveOffsetMs: number | null;
  readonly commands: PlaybackCommands;
  readonly testID?: string;
}

export function GoLiveButton({ isLive, liveOffsetMs, commands, testID }: Props) {
  if (!isLive || liveOffsetMs === null || liveOffsetMs <= LIVE_EDGE_TOLERANCE_MS) return null;
  return (
    <Pressable onPress={commands.goToLive} accessibilityRole="button" accessibilityLabel="Go live" style={styles.button} testID={testID}>
      <Text style={styles.text}>Go live</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: playerTokens.size.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: playerTokens.space.md,
    borderRadius: playerTokens.radius.pill,
    backgroundColor: playerTokens.color.live,
  },
  text: { color: playerTokens.color.onVideo, fontWeight: "600" },
});
```

```tsx
// components/VideoPlayer/ui/controls/LiveBadge.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { playerTokens } from "../../tokens";

export function LiveBadge({ isLive, testID }: { readonly isLive: boolean; readonly testID?: string }) {
  if (!isLive) return null;
  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel="Live" testID={testID}>
      <View style={styles.dot} />
      <Text style={styles.text}>LIVE</Text>
    </View>
  );
}

const DOT = 8;
const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: playerTokens.space.sm,
    paddingVertical: playerTokens.space.xs,
    borderRadius: playerTokens.radius.sm,
    backgroundColor: playerTokens.color.scrim,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: playerTokens.color.live, marginRight: playerTokens.space.xs },
  text: { color: playerTokens.color.onVideo, fontWeight: "700", fontSize: playerTokens.space.md },
});
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern="ui/(PlayPauseButton|SkipButton|controls)"` → all pass.

```bash
git add components/VideoPlayer/ui/controls __tests__/player/ui/PlayPauseButton.test.tsx __tests__/player/ui/SkipButton.test.tsx __tests__/player/ui/controls.test.tsx
git commit -m "feat(player): add state-driven control buttons and live badge

Verified: npm test -- --testPathPattern=\"ui/(PlayPauseButton|SkipButton|controls)\" => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: ProgressBar and TimeLabel

**Files:**
- Create: `ui/ProgressBar.tsx`, `ui/TimeLabel.tsx`
- Test: `__tests__/player/ui/ProgressBar.test.tsx`, `__tests__/player/ui/TimeLabel.test.tsx`

**Interfaces:**
```ts
export interface ProgressBarProps {
  readonly positionMs: number; readonly durationMs: number; readonly bufferedMs: number;
  readonly chapters?: readonly ChapterItem[]; readonly isLive: boolean; readonly disabled?: boolean;
  readonly onSeekStart: () => void; readonly onSeekPreview: (ms: number) => void; readonly onSeekCommit: (ms: number) => void; readonly onSeekCancel: () => void;
  readonly haptics: HapticsAdapter; readonly testID?: string;
}
export const ProgressBar: React.MemoExoticComponent<(p: ProgressBarProps) => JSX.Element | null>
export function TimeLabel({ positionMs, durationMs, isLive, liveOffsetMs, chapterTitle, testID }: {...}): JSX.Element
export const PROGRESS_BAR_TEST_IDS = { track: "progress-track", thumb: "progress-thumb", preview: "progress-preview", chapter: (i: number) => `progress-chapter-${i}` }
```

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/player/ui/ProgressBar.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import type { PanGesture, TapGesture } from "react-native-gesture-handler";
import { PROGRESS_BAR_TEST_IDS, ProgressBar, type ProgressBarProps } from "../../../components/VideoPlayer/ui/ProgressBar";

const WIDTH = 200;
function props(overrides: Partial<ProgressBarProps> = {}): ProgressBarProps {
  return {
    positionMs: 25_000, durationMs: 100_000, bufferedMs: 50_000, isLive: false,
    onSeekStart: jest.fn(), onSeekPreview: jest.fn(), onSeekCommit: jest.fn(), onSeekCancel: jest.fn(),
    haptics: { light: jest.fn() }, testID: "bar", ...overrides,
  };
}
function layout() {
  fireEvent(screen.getByTestId(PROGRESS_BAR_TEST_IDS.track), "layout", { nativeEvent: { layout: { width: WIDTH, height: 3, x: 0, y: 0 } } });
}

describe("ProgressBar", () => {
  it("renders played and buffered fractions as widths", () => {
    render(<ProgressBar {...props()} />);
    layout();
    expect(screen.getByTestId("progress-played").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: "25%" })]));
    expect(screen.getByTestId("progress-buffered").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: "50%" })]));
  });

  it("tap seeks to the tapped fraction and fires haptics", () => {
    const p = props();
    render(<ProgressBar {...p} />);
    layout();
    fireGestureHandler<TapGesture>(getByGestureTestId("progress-tap"), [{ x: WIDTH / 2 }]);
    expect(p.onSeekCommit).toHaveBeenCalledWith(50_000);
    expect(p.haptics.light).toHaveBeenCalledTimes(1);
  });

  it("scrub: start, preview, commit", () => {
    const p = props();
    render(<ProgressBar {...p} />);
    layout();
    fireGestureHandler<PanGesture>(getByGestureTestId("progress-pan"), [
      { state: State.BEGAN, x: 20 },
      { state: State.ACTIVE, x: 100 },
      { state: State.ACTIVE, x: 180 },
      { state: State.END, x: 180 },
    ]);
    expect(p.onSeekStart).toHaveBeenCalledTimes(1);
    expect(p.onSeekPreview).toHaveBeenCalledWith(50_000);
    expect(p.onSeekPreview).toHaveBeenLastCalledWith(90_000);
    expect(p.onSeekCommit).toHaveBeenCalledWith(90_000);
  });

  it("scrub cancelled (orientation change) commits nothing", () => {
    const p = props();
    render(<ProgressBar {...p} />);
    layout();
    fireGestureHandler<PanGesture>(getByGestureTestId("progress-pan"), [
      { state: State.BEGAN, x: 20 },
      { state: State.ACTIVE, x: 100 },
      { state: State.CANCELLED, x: 100 },
    ]);
    expect(p.onSeekCommit).not.toHaveBeenCalled();
    expect(p.onSeekCancel).toHaveBeenCalledTimes(1);
  });

  it("renders chapter ticks and tapping one seeks to its start", () => {
    const p = props({ chapters: [{ title: "A", startMs: 0 }, { title: "B", startMs: 40_000 }] });
    render(<ProgressBar {...p} />);
    layout();
    fireEvent.press(screen.getByTestId(PROGRESS_BAR_TEST_IDS.chapter(1)));
    expect(p.onSeekCommit).toHaveBeenCalledWith(40_000);
  });

  it("hidden for live without a window; disabled when disabled", () => {
    const { rerender } = render(<ProgressBar {...props({ isLive: true, durationMs: 0 })} />);
    expect(screen.queryByTestId("bar")).toBeNull();
    const p = props({ disabled: true });
    rerender(<ProgressBar {...p} />);
    layout();
    fireGestureHandler<TapGesture>(getByGestureTestId("progress-tap"), [{ x: 50 }]);
    expect(p.onSeekCommit).not.toHaveBeenCalled();
  });

  it("is adjustable with value text and increment/decrement actions", () => {
    const p = props();
    render(<ProgressBar {...p} />);
    const bar = screen.getByTestId("bar");
    expect(bar.props.accessibilityRole).toBe("adjustable");
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100_000, now: 25_000, text: "0:25 of 1:40" });
    fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(p.onSeekCommit).toHaveBeenLastCalledWith(35_000);
    fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(p.onSeekCommit).toHaveBeenLastCalledWith(15_000);
  });
});
```

```tsx
// __tests__/player/ui/TimeLabel.test.tsx
import { render, screen } from "@testing-library/react-native";
import { TimeLabel } from "../../../components/VideoPlayer/ui/TimeLabel";

describe("TimeLabel", () => {
  it("VOD shows position / duration", () => {
    render(<TimeLabel positionMs={65_000} durationMs={3_600_000} isLive={false} liveOffsetMs={null} chapterTitle={null} />);
    expect(screen.getByText("1:05 / 1:00:00")).toBeTruthy();
  });
  it("live at the edge shows LIVE; behind shows a negative offset", () => {
    const { rerender } = render(<TimeLabel positionMs={0} durationMs={0} isLive liveOffsetMs={2_000} chapterTitle={null} />);
    expect(screen.getByText("LIVE")).toBeTruthy();
    rerender(<TimeLabel positionMs={0} durationMs={0} isLive liveOffsetMs={35_000} chapterTitle={null} />);
    expect(screen.getByText("-0:35")).toBeTruthy();
  });
  it("appends the chapter title", () => {
    render(<TimeLabel positionMs={0} durationMs={10_000} isLive={false} liveOffsetMs={null} chapterTitle="Aarti" />);
    expect(screen.getByText("0:00 / 0:10 · Aarti")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```tsx
// components/VideoPlayer/ui/ProgressBar.tsx
// Spec: docs/player/06-ui-and-gestures-spec.md §5.3 and §4.3
import React, { memo, useCallback, useMemo, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { ChapterItem } from "../../../types/domain";
import { CHAPTER_MARKER_HIT_SLOP, LIVE_EDGE_TOLERANCE_MS, PRESS_SPRING, SKIP_MS } from "../constants";
import { clamp } from "../engine/pure/clamp";
import { formatTime } from "../engine/pure/formatTime";
import type { HapticsAdapter } from "../platform/types";
import { playerTokens } from "../tokens";

export interface ProgressBarProps {
  readonly positionMs: number;
  readonly durationMs: number;
  readonly bufferedMs: number;
  readonly chapters?: readonly ChapterItem[];
  readonly isLive: boolean;
  readonly disabled?: boolean;
  readonly onSeekStart: () => void;
  readonly onSeekPreview: (ms: number) => void;
  readonly onSeekCommit: (ms: number) => void;
  readonly onSeekCancel: () => void;
  readonly haptics: HapticsAdapter;
  readonly testID?: string;
}

export const PROGRESS_BAR_TEST_IDS = {
  track: "progress-track",
  played: "progress-played",
  buffered: "progress-buffered",
  thumb: "progress-thumb",
  preview: "progress-preview",
  chapter: (index: number) => `progress-chapter-${index}`,
} as const;

const THUMB_SCRUB_SCALE = 1.4;
const PAN_ACTIVATION_PX = 4;

function percent(ms: number, durationMs: number): `${number}%` {
  const fraction = durationMs > 0 ? clamp(ms / durationMs, 0, 1) : 0;
  return `${fraction * 100}%`;
}

export const ProgressBar = memo(function ProgressBar({
  positionMs,
  durationMs,
  bufferedMs,
  chapters,
  isLive,
  disabled = false,
  onSeekStart,
  onSeekPreview,
  onSeekCommit,
  onSeekCancel,
  haptics,
  testID,
}: ProgressBarProps) {
  const [width, setWidth] = useState(0);
  const [previewMs, setPreviewMs] = useState<number | null>(null);
  const thumbScale = useSharedValue(1);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ scale: thumbScale.value }] }));

  const onLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);
  const msAt = useCallback((x: number) => (width > 0 ? Math.round(clamp(x / width, 0, 1) * durationMs) : 0), [width, durationMs]);

  const commit = useCallback(
    (ms: number) => {
      setPreviewMs(null);
      thumbScale.value = withSpring(1, PRESS_SPRING);
      if (disabled) return; // gesture test utilities may invoke callbacks even on disabled gestures
      onSeekCommit(ms);
      haptics.light();
    },
    [disabled, haptics, onSeekCommit, thumbScale],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .withTestId("progress-tap")
        .enabled(!disabled)
        .runOnJS(true)
        .onEnd((event) => commit(msAt(event.x))),
    [commit, disabled, msAt],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId("progress-pan")
        .enabled(!disabled)
        .runOnJS(true)
        .activeOffsetX([-PAN_ACTIVATION_PX, PAN_ACTIVATION_PX])
        .onBegin(() => {
          thumbScale.value = withSpring(THUMB_SCRUB_SCALE, PRESS_SPRING);
          onSeekStart();
        })
        .onUpdate((event) => {
          const ms = msAt(event.x);
          setPreviewMs(ms);
          onSeekPreview(ms);
        })
        .onEnd((event) => commit(msAt(event.x)))
        .onFinalize((_event, success) => {
          if (!success) {
            setPreviewMs(null);
            thumbScale.value = withSpring(1, PRESS_SPRING);
            onSeekCancel();
          }
        }),
    [commit, disabled, msAt, onSeekCancel, onSeekPreview, onSeekStart, thumbScale],
  );

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === "increment") commit(clamp(positionMs + SKIP_MS, 0, durationMs));
      else if (name === "decrement") commit(clamp(positionMs - SKIP_MS, 0, durationMs));
    },
    [commit, durationMs, positionMs],
  );

  if (isLive && durationMs <= 0) return null; // live without a seekable window

  const shownMs = previewMs ?? positionMs;

  return (
    <View
      style={styles.container}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Seek"
      accessibilityValue={{ min: 0, max: durationMs, now: positionMs, text: `${formatTime(positionMs)} of ${formatTime(durationMs)}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View style={styles.hitArea}>
          <View style={styles.track} onLayout={onLayout} testID={PROGRESS_BAR_TEST_IDS.track}>
            <View style={[styles.fill, styles.buffered, { width: percent(bufferedMs, durationMs) }]} testID={PROGRESS_BAR_TEST_IDS.buffered} />
            <View style={[styles.fill, styles.played, { width: percent(shownMs, durationMs) }]} testID={PROGRESS_BAR_TEST_IDS.played} />
            {chapters?.map((chapter, index) =>
              durationMs > 0 ? (
                <Pressable
                  key={`${chapter.startMs}-${index}`}
                  testID={PROGRESS_BAR_TEST_IDS.chapter(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Chapter ${chapter.title}`}
                  hitSlop={CHAPTER_MARKER_HIT_SLOP}
                  onPress={() => commit(chapter.startMs)}
                  style={[styles.chapterTick, { left: percent(chapter.startMs, durationMs) }]}
                />
              ) : null,
            )}
            <Animated.View style={[styles.thumb, { left: percent(shownMs, durationMs) }, thumbStyle]} testID={PROGRESS_BAR_TEST_IDS.thumb} />
          </View>
          {previewMs !== null ? (
            <View style={[styles.preview, { left: percent(previewMs, durationMs) }]} testID={PROGRESS_BAR_TEST_IDS.preview}>
              <Text style={styles.previewText}>{formatTime(previewMs)}</Text>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: "100%" },
  hitArea: { height: playerTokens.size.minTouchTarget, justifyContent: "center" },
  track: { height: playerTokens.size.progressBar, backgroundColor: playerTokens.color.track, borderRadius: playerTokens.size.progressBar / 2 },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: playerTokens.size.progressBar / 2 },
  buffered: { backgroundColor: playerTokens.color.buffered },
  played: { backgroundColor: playerTokens.color.accent },
  chapterTick: {
    position: "absolute",
    top: -playerTokens.space.xs / 2,
    width: 2,
    height: playerTokens.size.progressBar + playerTokens.space.xs,
    backgroundColor: playerTokens.color.chapterTick,
  },
  thumb: {
    position: "absolute",
    top: (playerTokens.size.progressBar - playerTokens.size.thumb) / 2,
    marginLeft: -playerTokens.size.thumb / 2,
    width: playerTokens.size.thumb,
    height: playerTokens.size.thumb,
    borderRadius: playerTokens.size.thumb / 2,
    backgroundColor: playerTokens.color.accent,
  },
  preview: {
    position: "absolute",
    bottom: playerTokens.size.minTouchTarget,
    marginLeft: -playerTokens.space.xl,
    paddingHorizontal: playerTokens.space.sm,
    paddingVertical: playerTokens.space.xs,
    borderRadius: playerTokens.radius.sm,
    backgroundColor: playerTokens.color.surface,
  },
  previewText: { color: playerTokens.color.onVideo, fontVariant: ["tabular-nums"] },
});
```

Remove the unused `LIVE_EDGE_TOLERANCE_MS` import from `ProgressBar.tsx` (it is not needed; the live-window rule is `durationMs <= 0`).

```tsx
// components/VideoPlayer/ui/TimeLabel.tsx
import React from "react";
import { StyleSheet, Text } from "react-native";
import { LIVE_EDGE_TOLERANCE_MS } from "../constants";
import { formatTime } from "../engine/pure/formatTime";
import { playerTokens } from "../tokens";

interface Props {
  readonly positionMs: number;
  readonly durationMs: number;
  readonly isLive: boolean;
  readonly liveOffsetMs: number | null;
  readonly chapterTitle: string | null;
  readonly testID?: string;
}

export function TimeLabel({ positionMs, durationMs, isLive, liveOffsetMs, chapterTitle, testID }: Props) {
  const time = isLive
    ? liveOffsetMs !== null && liveOffsetMs > LIVE_EDGE_TOLERANCE_MS
      ? `-${formatTime(liveOffsetMs)}`
      : "LIVE"
    : `${formatTime(positionMs)} / ${formatTime(durationMs)}`;
  return (
    <Text style={styles.text} numberOfLines={1} testID={testID}>
      {chapterTitle ? `${time} · ${chapterTitle}` : time}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { color: playerTokens.color.onVideo, fontVariant: ["tabular-nums"], flexShrink: 1 },
});
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern="ui/(ProgressBar|TimeLabel)"` → all pass. If `fireGestureHandler` reports "handler not found", confirm `.withTestId(...)` is on the gesture and `react-native-gesture-handler/jestSetup` is loaded (Task 1).

```bash
git add components/VideoPlayer/ui/ProgressBar.tsx components/VideoPlayer/ui/TimeLabel.tsx __tests__/player/ui/ProgressBar.test.tsx __tests__/player/ui/TimeLabel.test.tsx
git commit -m "feat(player): add ProgressBar with scrub, chapters, accessibility actions, and TimeLabel

Verified: npm test -- --testPathPattern=\"ui/(ProgressBar|TimeLabel)\" => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: CaptionsView, BufferingIndicator, Toast, SwipeIndicator

**Files:**
- Create: `ui/CaptionsView.tsx`, `ui/BufferingIndicator.tsx`, `ui/Toast.tsx`, `ui/SwipeIndicator.tsx`
- Test: `__tests__/player/ui/transient.test.tsx`

**Interfaces:**
```ts
CaptionsView({ captions: readonly CaptionItem[]; positionMs: number; testID?: string })            // memo; null when no cue
BufferingIndicator({ status: PlaybackStatus; testID?: string })                                     // visible after BUFFERING_INDICATOR_DELAY_MS in loading|buffering
Toast({ message: string | null; testID?: string })                                                  // presentational; timing lives in the root's useToast (Increment 4)
SwipeIndicator({ level: { kind: "brightness" | "volume"; level: number } | null; testID?: string })
```

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/player/ui/transient.test.tsx
import { act, render, screen } from "@testing-library/react-native";
import { PixelRatio } from "react-native";
import { CaptionsView } from "../../../components/VideoPlayer/ui/CaptionsView";
import { BufferingIndicator } from "../../../components/VideoPlayer/ui/BufferingIndicator";
import { Toast } from "../../../components/VideoPlayer/ui/Toast";
import { SwipeIndicator } from "../../../components/VideoPlayer/ui/SwipeIndicator";
import { BUFFERING_INDICATOR_DELAY_MS, CAPTION_FONT_SIZE } from "../../../components/VideoPlayer/constants";

describe("CaptionsView", () => {
  const cues = [{ start: 0, end: 2, text: "Om" }, { start: 5, end: 6, text: "Shanti" }];
  it("shows the active cue and nothing in a gap", () => {
    const { rerender } = render(<CaptionsView captions={cues} positionMs={1_000} testID="cc" />);
    expect(screen.getByText("Om")).toBeTruthy();
    rerender(<CaptionsView captions={cues} positionMs={3_000} testID="cc" />);
    expect(screen.queryByTestId("cc")).toBeNull();
  });
  it("scales the font with the accessibility font scale", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.5);
    render(<CaptionsView captions={cues} positionMs={1_000} />);
    expect(screen.getByText("Om").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: CAPTION_FONT_SIZE * 1.5 })]));
  });
});

describe("BufferingIndicator", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("appears after the delay in buffering and disappears immediately when playing", () => {
    const { rerender } = render(<BufferingIndicator status="buffering" testID="spin" />);
    expect(screen.queryByTestId("spin")).toBeNull();
    act(() => jest.advanceTimersByTime(BUFFERING_INDICATOR_DELAY_MS));
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    rerender(<BufferingIndicator status="playing" testID="spin" />);
    expect(screen.queryByTestId("spin")).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
  it("a stall shorter than the delay never flashes", () => {
    const { rerender } = render(<BufferingIndicator status="loading" testID="spin" />);
    act(() => jest.advanceTimersByTime(BUFFERING_INDICATOR_DELAY_MS - 1));
    rerender(<BufferingIndicator status="ready" testID="spin" />);
    act(() => jest.advanceTimersByTime(10));
    expect(screen.queryByTestId("spin")).toBeNull();
  });
  it("unmount clears the timer", () => {
    const { unmount } = render(<BufferingIndicator status="loading" />);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("Toast", () => {
  it("renders the message with a live region and nothing when null", () => {
    const { rerender } = render(<Toast message="Autoplay is on" testID="toast" />);
    expect(screen.getByText("Autoplay is on")).toBeTruthy();
    expect(screen.getByTestId("toast").props.accessibilityLiveRegion).toBe("polite");
    rerender(<Toast message={null} testID="toast" />);
    expect(screen.queryByTestId("toast")).toBeNull();
  });
});

describe("SwipeIndicator", () => {
  it("renders the level as a fill height and the right icon; hidden when null", () => {
    const { rerender } = render(<SwipeIndicator level={{ kind: "volume", level: 0.25 }} testID="swipe" />);
    expect(screen.getByTestId("swipe-fill").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: "25%" })]));
    expect(screen.getByLabelText("Volume 25%")).toBeTruthy();
    rerender(<SwipeIndicator level={null} testID="swipe" />);
    expect(screen.queryByTestId("swipe")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```tsx
// components/VideoPlayer/ui/CaptionsView.tsx
import React, { memo, useMemo } from "react";
import { PixelRatio, StyleSheet, Text, View } from "react-native";
import type { CaptionItem } from "../../../types/domain";
import { CAPTION_FONT_SIZE } from "../constants";
import { selectCue } from "../engine/pure/selectCue";
import { playerTokens } from "../tokens";

interface Props {
  readonly captions: readonly CaptionItem[];
  readonly positionMs: number;
  readonly testID?: string;
}

export const CaptionsView = memo(function CaptionsView({ captions, positionMs, testID }: Props) {
  const cue = useMemo(() => selectCue(captions, positionMs), [captions, positionMs]);
  if (!cue) return null;
  return (
    <View style={styles.container} pointerEvents="none" accessibilityLiveRegion="polite" testID={testID}>
      <Text style={[styles.text, { fontSize: CAPTION_FONT_SIZE * PixelRatio.getFontScale() }]}>{cue.text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: playerTokens.size.bottomRowHeight + playerTokens.space.sm,
    alignItems: "center",
  },
  text: {
    maxWidth: "90%",
    textAlign: "center",
    color: playerTokens.color.captionText,
    backgroundColor: playerTokens.color.captionBackground,
    paddingHorizontal: playerTokens.space.sm,
    paddingVertical: playerTokens.space.xs,
    borderRadius: playerTokens.radius.sm,
  },
});
```

```tsx
// components/VideoPlayer/ui/BufferingIndicator.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BUFFERING_INDICATOR_DELAY_MS } from "../constants";
import type { PlaybackStatus } from "../engine/types";
import { playerTokens } from "../tokens";

interface Props {
  readonly status: PlaybackStatus;
  readonly testID?: string;
}

export function BufferingIndicator({ status, testID }: Props) {
  const waiting = status === "loading" || status === "buffering";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!waiting) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), BUFFERING_INDICATOR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (!visible) return null;
  return (
    <View style={styles.container} pointerEvents="none" testID={testID}>
      <ActivityIndicator size="large" color={playerTokens.color.onVideo} accessibilityLabel="Loading" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
```

```tsx
// components/VideoPlayer/ui/Toast.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { CONTROLS_FADE_MS } from "../constants";
import { playerTokens } from "../tokens";

interface Props {
  readonly message: string | null;
  readonly testID?: string;
}

export function Toast({ message, testID }: Props) {
  if (message === null) return null;
  return (
    <View style={styles.anchor} pointerEvents="none">
      <Animated.View entering={FadeIn.duration(CONTROLS_FADE_MS)} exiting={FadeOut.duration(CONTROLS_FADE_MS)} style={styles.toast} accessibilityLiveRegion="polite" testID={testID}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", top: playerTokens.size.minTouchTarget + playerTokens.space.lg, left: 0, right: 0, alignItems: "center", zIndex: playerTokens.z.toast },
  toast: { paddingHorizontal: playerTokens.space.lg, paddingVertical: playerTokens.space.sm, borderRadius: playerTokens.radius.pill, backgroundColor: playerTokens.color.surface },
  text: { color: playerTokens.color.onVideo },
});
```

```tsx
// components/VideoPlayer/ui/SwipeIndicator.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { playerTokens } from "../tokens";

export interface SwipeLevel {
  readonly kind: "brightness" | "volume";
  readonly level: number;
}

interface Props {
  readonly level: SwipeLevel | null;
  readonly testID?: string;
}

const PERCENT = 100;

export function SwipeIndicator({ level, testID }: Props) {
  if (!level) return null;
  const pct = Math.round(level.level * PERCENT);
  const label = `${level.kind === "brightness" ? "Brightness" : "Volume"} ${pct}%`;
  return (
    <View style={[styles.container, level.kind === "brightness" ? styles.left : styles.right]} pointerEvents="none" accessibilityLabel={label} testID={testID}>
      <View style={styles.bar}>
        <View style={[styles.fill, { height: `${pct}%` }]} testID={`${testID ?? "swipe"}-fill`} />
      </View>
      <MaterialCommunityIcons name={level.kind === "brightness" ? "brightness-6" : "volume-high"} size={playerTokens.size.controlSm} color={playerTokens.color.onVideo} />
    </View>
  );
}

const BAR_WIDTH = 6;
const styles = StyleSheet.create({
  container: { position: "absolute", top: 0, bottom: 0, justifyContent: "center", alignItems: "center", width: "33%" },
  left: { left: 0 },
  right: { right: 0 },
  bar: { width: BAR_WIDTH, height: playerTokens.size.swipeIndicatorHeight, borderRadius: BAR_WIDTH / 2, backgroundColor: playerTokens.color.track, justifyContent: "flex-end", overflow: "hidden", marginBottom: playerTokens.space.sm },
  fill: { width: "100%", backgroundColor: playerTokens.color.onVideo },
});
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern=ui/transient` → all pass. If the Reanimated mock does not support `entering`/`exiting`, the props are ignored in tests; fine.

```bash
git add components/VideoPlayer/ui/CaptionsView.tsx components/VideoPlayer/ui/BufferingIndicator.tsx components/VideoPlayer/ui/Toast.tsx components/VideoPlayer/ui/SwipeIndicator.tsx __tests__/player/ui/transient.test.tsx
git commit -m "feat(player): add captions view, buffering indicator, toast and swipe indicator

Verified: npm test -- --testPathPattern=ui/transient => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: ErrorCard and EndScreen

**Files:**
- Create: `ui/ErrorCard.tsx`, `ui/EndScreen.tsx`
- Test: `__tests__/player/ui/ErrorCard.test.tsx`, `__tests__/player/ui/EndScreen.test.tsx`

**Interfaces:**
```ts
ErrorCard({ error: PlaybackError | null; retryAttempt: number; retrying: boolean; onRetry: () => void; testID?: string })
EndScreen({ visible: boolean; secondsLeft: number | null; onReplay: () => void; onCancelAutoplay: () => void; testID?: string })
```

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/player/ui/ErrorCard.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ErrorCard } from "../../../components/VideoPlayer/ui/ErrorCard";
import { ERROR_MESSAGES, MAX_RETRIES } from "../../../components/VideoPlayer/constants";
import type { PlaybackError } from "../../../components/VideoPlayer/engine/types";

const net: PlaybackError = { code: "network", message: ERROR_MESSAGES.network, retryable: true };
const unsupported: PlaybackError = { code: "unsupported", message: ERROR_MESSAGES.unsupported, retryable: false };

describe("ErrorCard", () => {
  it("hidden without an error", () => {
    render(<ErrorCard error={null} retryAttempt={0} retrying={false} onRetry={jest.fn()} testID="err" />);
    expect(screen.queryByTestId("err")).toBeNull();
  });
  it("shows the message and a retrying line while an automatic retry is in flight", () => {
    render(<ErrorCard error={net} retryAttempt={2} retrying onRetry={jest.fn()} />);
    expect(screen.getByText(ERROR_MESSAGES.network)).toBeTruthy();
    expect(screen.getByText(`Retrying (2/${MAX_RETRIES})…`)).toBeTruthy();
    expect(screen.queryByLabelText("Retry")).toBeNull();
  });
  it("offers Retry after retries are exhausted", () => {
    const onRetry = jest.fn();
    render(<ErrorCard error={net} retryAttempt={MAX_RETRIES} retrying={false} onRetry={onRetry} />);
    fireEvent.press(screen.getByLabelText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it("no Retry for non-retryable errors and uses an assertive live region", () => {
    render(<ErrorCard error={unsupported} retryAttempt={0} retrying={false} onRetry={jest.fn()} testID="err" />);
    expect(screen.queryByLabelText("Retry")).toBeNull();
    expect(screen.getByTestId("err").props.accessibilityLiveRegion).toBe("assertive");
  });
});
```

```tsx
// __tests__/player/ui/EndScreen.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { EndScreen } from "../../../components/VideoPlayer/ui/EndScreen";

describe("EndScreen", () => {
  it("hidden when not visible", () => {
    render(<EndScreen visible={false} secondsLeft={null} onReplay={jest.fn()} onCancelAutoplay={jest.fn()} testID="end" />);
    expect(screen.queryByTestId("end")).toBeNull();
  });
  it("replay only when there is no countdown", () => {
    const onReplay = jest.fn();
    render(<EndScreen visible secondsLeft={null} onReplay={onReplay} onCancelAutoplay={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Replay"));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Up next/)).toBeNull();
  });
  it("shows the countdown and cancel", () => {
    const onCancel = jest.fn();
    render(<EndScreen visible secondsLeft={4} onReplay={jest.fn()} onCancelAutoplay={onCancel} />);
    expect(screen.getByText("Up next in 4")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Cancel autoplay"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```tsx
// components/VideoPlayer/ui/ErrorCard.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MAX_RETRIES } from "../constants";
import type { PlaybackError } from "../engine/types";
import { playerTokens } from "../tokens";

interface Props {
  readonly error: PlaybackError | null;
  readonly retryAttempt: number;
  readonly retrying: boolean;
  readonly onRetry: () => void;
  readonly testID?: string;
}

export function ErrorCard({ error, retryAttempt, retrying, onRetry, testID }: Props) {
  if (!error) return null;
  const showRetrying = retrying && retryAttempt > 0 && error.retryable;
  const showButton = !showRetrying && error.retryable;
  return (
    <View style={styles.backdrop} accessibilityLiveRegion="assertive" testID={testID}>
      <View style={styles.card}>
        <MaterialCommunityIcons name="alert-circle-outline" size={playerTokens.size.controlSm} color={playerTokens.color.onVideo} />
        <Text style={styles.message}>{error.message}</Text>
        {showRetrying ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={playerTokens.color.onVideo} />
            <Text style={styles.retrying}>{`Retrying (${retryAttempt}/${MAX_RETRIES})…`}</Text>
          </View>
        ) : null}
        {showButton ? (
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry" style={styles.button}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: playerTokens.z.overlay },
  card: { maxWidth: "80%", alignItems: "center", padding: playerTokens.space.xl, borderRadius: playerTokens.radius.md, backgroundColor: playerTokens.color.surface },
  message: { color: playerTokens.color.onVideo, textAlign: "center", marginTop: playerTokens.space.sm },
  row: { flexDirection: "row", alignItems: "center", marginTop: playerTokens.space.md },
  retrying: { color: playerTokens.color.onVideo, marginLeft: playerTokens.space.sm },
  button: { marginTop: playerTokens.space.lg, minHeight: playerTokens.size.minTouchTarget, justifyContent: "center", paddingHorizontal: playerTokens.space.xl, borderRadius: playerTokens.radius.pill, backgroundColor: playerTokens.color.accent },
  buttonText: { color: playerTokens.color.onVideo, fontWeight: "600" },
});
```

```tsx
// components/VideoPlayer/ui/EndScreen.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { playerTokens } from "../tokens";
import { ControlButton } from "./controls/ControlButton";

interface Props {
  readonly visible: boolean;
  readonly secondsLeft: number | null;
  readonly onReplay: () => void;
  readonly onCancelAutoplay: () => void;
  readonly testID?: string;
}

export function EndScreen({ visible, secondsLeft, onReplay, onCancelAutoplay, testID }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.container} testID={testID}>
      <ControlButton icon="replay" accessibilityLabel="Replay" onPress={onReplay} size="lg" />
      {secondsLeft !== null ? (
        <View style={styles.upNext}>
          <Text style={styles.text} accessibilityLiveRegion="polite">{`Up next in ${secondsLeft}`}</Text>
          <Pressable onPress={onCancelAutoplay} accessibilityRole="button" accessibilityLabel="Cancel autoplay" style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: playerTokens.z.overlay },
  upNext: { marginTop: playerTokens.space.lg, alignItems: "center" },
  text: { color: playerTokens.color.onVideo },
  cancel: { marginTop: playerTokens.space.sm, minHeight: playerTokens.size.minTouchTarget, justifyContent: "center", paddingHorizontal: playerTokens.space.lg },
  cancelText: { color: playerTokens.color.onVideo, textDecorationLine: "underline" },
});
```

- [ ] **Step 3: Run and commit**

```bash
git add components/VideoPlayer/ui/ErrorCard.tsx components/VideoPlayer/ui/EndScreen.tsx __tests__/player/ui/ErrorCard.test.tsx __tests__/player/ui/EndScreen.test.tsx
git commit -m "feat(player): add error card with retry states and end screen with countdown

Verified: npm test -- --testPathPattern=\"ui/(ErrorCard|EndScreen)\" => 7 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: SettingsSheet

**Files:**
- Create: `ui/SettingsSheet.tsx`
- Test: `__tests__/player/ui/SettingsSheet.test.tsx`

**Interfaces:**
```ts
export interface SettingsSheetProps {
  readonly visible: boolean; readonly onClose: () => void;
  readonly rate: number; readonly onRate: (rate: number) => void;
  readonly captionsAvailable: boolean; readonly captionsEnabled: boolean; readonly onToggleCaptions: (enabled: boolean) => void;
  readonly subtitleTracks: readonly SubtitleTrackInfo[]; readonly activeSubtitle: SubtitleTrackInfo | null; readonly onSelectSubtitle: (track: SubtitleTrackInfo | null) => void;
  readonly activeQualityLabel: string | null; readonly testID?: string;
}
```

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/player/ui/SettingsSheet.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SettingsSheet, type SettingsSheetProps } from "../../../components/VideoPlayer/ui/SettingsSheet";
import { PLAYBACK_RATES } from "../../../components/VideoPlayer/constants";

function props(overrides: Partial<SettingsSheetProps> = {}): SettingsSheetProps {
  return {
    visible: true, onClose: jest.fn(), rate: 1, onRate: jest.fn(),
    captionsAvailable: true, captionsEnabled: false, onToggleCaptions: jest.fn(),
    subtitleTracks: [], activeSubtitle: null, onSelectSubtitle: jest.fn(),
    activeQualityLabel: null, testID: "sheet", ...overrides,
  };
}

describe("SettingsSheet", () => {
  it("lists every rate, marks the active one, and selects", () => {
    const p = props({ rate: 1.5 });
    render(<SettingsSheet {...p} />);
    for (const rate of PLAYBACK_RATES) expect(screen.getByLabelText(`Speed ${rate}×`)).toBeTruthy();
    expect(screen.getByLabelText("Speed 1.5×").props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByLabelText("Speed 2×"));
    expect(p.onRate).toHaveBeenCalledWith(2);
  });
  it("captions switch toggles; hidden when unavailable", () => {
    const p = props();
    const { rerender } = render(<SettingsSheet {...p} />);
    fireEvent(screen.getByLabelText("Captions"), "valueChange", true);
    expect(p.onToggleCaptions).toHaveBeenCalledWith(true);
    rerender(<SettingsSheet {...props({ captionsAvailable: false })} />);
    expect(screen.queryByLabelText("Captions")).toBeNull();
  });
  it("lists subtitle tracks with Off and selects", () => {
    const p = props({ subtitleTracks: [{ id: "hi", language: "hi", label: "Hindi" }], activeSubtitle: null });
    render(<SettingsSheet {...p} />);
    fireEvent.press(screen.getByLabelText("Subtitles Hindi"));
    expect(p.onSelectSubtitle).toHaveBeenCalledWith({ id: "hi", language: "hi", label: "Hindi" });
    fireEvent.press(screen.getByLabelText("Subtitles Off"));
    expect(p.onSelectSubtitle).toHaveBeenLastCalledWith(null);
  });
  it("shows the quality label read-only or hides the row", () => {
    const { rerender } = render(<SettingsSheet {...props({ activeQualityLabel: "Auto · 720p" })} />);
    expect(screen.getByText("Auto · 720p")).toBeTruthy();
    rerender(<SettingsSheet {...props({ activeQualityLabel: null })} />);
    expect(screen.queryByText(/Quality/)).toBeNull();
  });
  it("backdrop press and Close call onClose; hidden when not visible", () => {
    const p = props();
    const { rerender } = render(<SettingsSheet {...p} />);
    fireEvent.press(screen.getByLabelText("Close settings"));
    expect(p.onClose).toHaveBeenCalledTimes(1);
    rerender(<SettingsSheet {...props({ visible: false })} />);
    expect(screen.queryByTestId("sheet")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```tsx
// components/VideoPlayer/ui/SettingsSheet.tsx
// Speed, captions, subtitle track, quality (read-only). Spec: 06 §5.11
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { PLAYBACK_RATES } from "../constants";
import type { SubtitleTrackInfo } from "../engine/types";
import { playerTokens } from "../tokens";

export interface SettingsSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly rate: number;
  readonly onRate: (rate: number) => void;
  readonly captionsAvailable: boolean;
  readonly captionsEnabled: boolean;
  readonly onToggleCaptions: (enabled: boolean) => void;
  readonly subtitleTracks: readonly SubtitleTrackInfo[];
  readonly activeSubtitle: SubtitleTrackInfo | null;
  readonly onSelectSubtitle: (track: SubtitleTrackInfo | null) => void;
  readonly activeQualityLabel: string | null;
  readonly testID?: string;
}

function Chip({ label, selected, onPress, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export function SettingsSheet({
  visible,
  onClose,
  rate,
  onRate,
  captionsAvailable,
  captionsEnabled,
  onToggleCaptions,
  subtitleTracks,
  activeSubtitle,
  onSelectSubtitle,
  activeQualityLabel,
  testID,
}: SettingsSheetProps) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" />
      <View style={styles.sheet}>
        <ScrollView>
          <Text style={styles.heading}>Speed</Text>
          <View style={styles.row}>
            {PLAYBACK_RATES.map((value) => (
              <Chip key={value} label={`${value}×`} selected={value === rate} onPress={() => onRate(value)} accessibilityLabel={`Speed ${value}×`} />
            ))}
          </View>
          {captionsAvailable ? (
            <View style={styles.switchRow}>
              <Text style={styles.heading}>Captions</Text>
              <Switch value={captionsEnabled} onValueChange={onToggleCaptions} accessibilityLabel="Captions" />
            </View>
          ) : null}
          {subtitleTracks.length > 0 ? (
            <>
              <Text style={styles.heading}>Subtitles</Text>
              <View style={styles.row}>
                <Chip label="Off" selected={activeSubtitle === null} onPress={() => onSelectSubtitle(null)} accessibilityLabel="Subtitles Off" />
                {subtitleTracks.map((track) => (
                  <Chip key={track.id} label={track.label} selected={activeSubtitle?.id === track.id} onPress={() => onSelectSubtitle(track)} accessibilityLabel={`Subtitles ${track.label}`} />
                ))}
              </View>
            </>
          ) : null}
          {activeQualityLabel !== null ? (
            <View style={styles.switchRow}>
              <Text style={styles.heading}>Quality</Text>
              <Text style={styles.value}>{activeQualityLabel}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: playerTokens.color.scrim },
  sheet: { backgroundColor: playerTokens.color.surface, padding: playerTokens.space.lg, borderTopLeftRadius: playerTokens.radius.lg, borderTopRightRadius: playerTokens.radius.lg },
  heading: { color: playerTokens.color.onVideo, fontWeight: "600", marginTop: playerTokens.space.md, marginBottom: playerTokens.space.sm },
  row: { flexDirection: "row", flexWrap: "wrap" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chip: { minHeight: playerTokens.size.minTouchTarget, justifyContent: "center", paddingHorizontal: playerTokens.space.md, marginRight: playerTokens.space.sm, marginBottom: playerTokens.space.sm, borderRadius: playerTokens.radius.pill, backgroundColor: playerTokens.color.track },
  chipSelected: { backgroundColor: playerTokens.color.accent },
  chipText: { color: playerTokens.color.onVideo },
  value: { color: playerTokens.color.onVideo, marginTop: playerTokens.space.md },
});
```

- [ ] **Step 3: Run and commit**

```bash
git add components/VideoPlayer/ui/SettingsSheet.tsx __tests__/player/ui/SettingsSheet.test.tsx
git commit -m "feat(player): add settings sheet for speed, captions, subtitles and quality label

Verified: npm test -- --testPathPattern=ui/SettingsSheet => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: PlayerSurface and MiniPlayer

**Files:**
- Create: `ui/PlayerSurface.tsx`, `ui/MiniPlayer.tsx`
- Test: `__tests__/player/ui/PlayerSurface.test.tsx`, `__tests__/player/ui/MiniPlayer.test.tsx`

**Interfaces:**
```ts
export interface PlayerSurfaceProps {
  readonly player: VideoPlayer; readonly posterUrl?: string; readonly showPoster: boolean;
  readonly allowsPictureInPicture: boolean; readonly onPictureInPictureStart: () => void; readonly onPictureInPictureStop: () => void;
  readonly onLayout: (event: LayoutChangeEvent) => void; readonly children?: React.ReactNode; readonly testID?: string;
}
export const PlayerSurface: React.ForwardRefExoticComponent<PlayerSurfaceProps & React.RefAttributes<VideoView>>
export const PLAYER_SURFACE_TEST_IDS = { video: "player-video-view", poster: "player-poster" }
MiniPlayer({ status: PlaybackStatus; commands: PlaybackCommands; onRestore: () => void; onClose: () => void; children?: ReactNode; testID?: string })
```

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/player/ui/PlayerSurface.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PLAYER_SURFACE_TEST_IDS, PlayerSurface } from "../../../components/VideoPlayer/ui/PlayerSurface";
import type { VideoPlayer } from "expo-video";

jest.mock("expo-video", () => {
  const ReactLib = require("react");
  return {
    VideoView: ReactLib.forwardRef((props: Record<string, unknown>, ref: unknown) => ReactLib.createElement("VideoView", { ...props, ref })),
  };
});
jest.mock("expo-image", () => {
  const ReactLib = require("react");
  return { Image: (props: Record<string, unknown>) => ReactLib.createElement("Image", props) };
});

const player = {} as VideoPlayer;

describe("PlayerSurface", () => {
  it("renders VideoView with custom controls disabled and forwards PiP props", () => {
    const onStart = jest.fn();
    render(<PlayerSurface player={player} showPoster={false} allowsPictureInPicture onPictureInPictureStart={onStart} onPictureInPictureStop={jest.fn()} onLayout={jest.fn()} />);
    const view = screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video);
    expect(view.props.nativeControls).toBe(false);
    expect(view.props.allowsFullscreen).toBe(false);
    expect(view.props.allowsPictureInPicture).toBe(true);
    expect(view.props.contentFit).toBe("contain");
    expect(view.props.onPictureInPictureStart).toBe(onStart);
  });
  it("shows the poster only when asked and a URL exists", () => {
    const { rerender } = render(<PlayerSurface player={player} posterUrl="https://x/p.jpg" showPoster allowsPictureInPicture={false} onPictureInPictureStart={jest.fn()} onPictureInPictureStop={jest.fn()} onLayout={jest.fn()} />);
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeTruthy();
    rerender(<PlayerSurface player={player} posterUrl="https://x/p.jpg" showPoster={false} allowsPictureInPicture={false} onPictureInPictureStart={jest.fn()} onPictureInPictureStop={jest.fn()} onLayout={jest.fn()} />);
    expect(screen.queryByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeNull();
  });
  it("renders children above the video and forwards the ref", () => {
    const ref = React.createRef<never>();
    render(
      <PlayerSurface ref={ref} player={player} showPoster={false} allowsPictureInPicture={false} onPictureInPictureStart={jest.fn()} onPictureInPictureStop={jest.fn()} onLayout={jest.fn()}>
        <></>
      </PlayerSurface>,
    );
    expect(ref.current).not.toBeNull();
  });
});
```

```tsx
// __tests__/player/ui/MiniPlayer.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MiniPlayer } from "../../../components/VideoPlayer/ui/MiniPlayer";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

describe("MiniPlayer", () => {
  it("tapping the video area restores; close calls onClose; play/pause forwards", () => {
    const onRestore = jest.fn();
    const onClose = jest.fn();
    const c = commands();
    render(<MiniPlayer status="playing" commands={c} onRestore={onRestore} onClose={onClose} testID="mini" />);
    fireEvent.press(screen.getByLabelText("Restore player"));
    expect(onRestore).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText("Close mini player"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText("Pause"));
    expect(c.togglePlay).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```tsx
// components/VideoPlayer/ui/PlayerSurface.tsx
// Renders the expo-video surface and the poster. R3 exception: imports VideoView only.
import { Image } from "expo-image";
import { VideoView, type VideoPlayer } from "expo-video";
import React, { forwardRef } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { playerTokens } from "../tokens";

export interface PlayerSurfaceProps {
  readonly player: VideoPlayer;
  readonly posterUrl?: string;
  readonly showPoster: boolean;
  readonly allowsPictureInPicture: boolean;
  readonly onPictureInPictureStart: () => void;
  readonly onPictureInPictureStop: () => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly children?: React.ReactNode;
  readonly testID?: string;
}

export const PLAYER_SURFACE_TEST_IDS = { video: "player-video-view", poster: "player-poster" } as const;

export const PlayerSurface = forwardRef<VideoView, PlayerSurfaceProps>(function PlayerSurface(
  { player, posterUrl, showPoster, allowsPictureInPicture, onPictureInPictureStart, onPictureInPictureStop, onLayout, children, testID },
  ref,
) {
  return (
    <View style={styles.container} onLayout={onLayout} testID={testID}>
      <VideoView
        ref={ref}
        player={player}
        style={styles.fill}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={allowsPictureInPicture}
        startsPictureInPictureAutomatically={allowsPictureInPicture}
        onPictureInPictureStart={onPictureInPictureStart}
        onPictureInPictureStop={onPictureInPictureStop}
        testID={PLAYER_SURFACE_TEST_IDS.video}
      />
      {showPoster && posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.fill} contentFit="contain" accessible={false} testID={PLAYER_SURFACE_TEST_IDS.poster} />
      ) : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", height: "100%", backgroundColor: playerTokens.color.videoBackground, overflow: "hidden" },
  fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
});
```

```tsx
// components/VideoPlayer/ui/MiniPlayer.tsx
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { PlaybackCommands, PlaybackStatus } from "../engine/types";
import { playerTokens } from "../tokens";
import { ControlButton } from "./controls/ControlButton";
import { PlayPauseButton } from "./controls/PlayPauseButton";

interface Props {
  readonly status: PlaybackStatus;
  readonly commands: PlaybackCommands;
  readonly onRestore: () => void;
  readonly onClose: () => void;
  readonly testID?: string;
}

export function MiniPlayer({ status, commands, onRestore, onClose, testID }: Props) {
  return (
    <View style={styles.overlay} testID={testID}>
      <Pressable style={styles.restoreArea} onPress={onRestore} accessibilityRole="button" accessibilityLabel="Restore player" />
      <View style={styles.column}>
        <PlayPauseButton status={status} commands={commands} size="sm" />
        <ControlButton icon="close" accessibilityLabel="Close mini player" onPress={onClose} size="sm" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row" },
  restoreArea: { flex: 1 },
  column: { justifyContent: "space-between", padding: playerTokens.space.xs },
});
```

- [ ] **Step 3: Run and commit**

```bash
git add components/VideoPlayer/ui/PlayerSurface.tsx components/VideoPlayer/ui/MiniPlayer.tsx __tests__/player/ui/PlayerSurface.test.tsx __tests__/player/ui/MiniPlayer.test.tsx
git commit -m "feat(player): add PlayerSurface (VideoView + poster) and MiniPlayer

Verified: npm test -- --testPathPattern=\"ui/(PlayerSurface|MiniPlayer)\" => 4 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: ControlsOverlay

**Files:**
- Create: `ui/ControlsOverlay.tsx`
- Test: `__tests__/player/ui/ControlsOverlay.test.tsx`

**Interfaces:**
```ts
export interface ControlsOverlayProps {
  readonly snapshot: PlaybackSnapshot; readonly commands: PlaybackCommands;
  readonly visible: boolean; readonly opacity: SharedValue<number>;
  readonly layoutMode: "inline" | "fullscreen"; readonly insets: EdgeInsets;
  readonly hasNext: boolean; readonly hasPrevious: boolean; readonly isAutoplayNextEnabled: boolean;
  readonly chapters?: readonly ChapterItem[]; readonly pipSupported: boolean; readonly haptics: HapticsAdapter;
  readonly onNext: () => void; readonly onPrevious: () => void; readonly onToggleAutoplayNext: (enabled: boolean) => void;
  readonly onToggleFullscreen: () => void; readonly onToggleMinimize: () => void; readonly onOpenSettings: () => void; readonly onPip: () => void;
  readonly onSeekStart: () => void; readonly onSeekPreview: (ms: number) => void; readonly onSeekCommit: (ms: number) => void; readonly onSeekCancel: () => void;
  readonly testID?: string;
}
export const ControlsOverlay: React.MemoExoticComponent<(p: ControlsOverlayProps) => JSX.Element>
```

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/player/ui/ControlsOverlay.test.tsx
import { render, screen } from "@testing-library/react-native";
import { makeMutable } from "react-native-reanimated";
import { ControlsOverlay, type ControlsOverlayProps } from "../../../components/VideoPlayer/ui/ControlsOverlay";
import { liveSnapshot, playingSnapshot, errorSnapshot } from "../fakes/snapshots";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

function props(overrides: Partial<ControlsOverlayProps> = {}): ControlsOverlayProps {
  return {
    snapshot: playingSnapshot(), commands: commands(), visible: true, opacity: makeMutable(1), layoutMode: "inline",
    insets: { top: 0, bottom: 0, left: 0, right: 0 }, hasNext: true, hasPrevious: false, isAutoplayNextEnabled: true,
    pipSupported: true, haptics: { light: jest.fn() },
    onNext: jest.fn(), onPrevious: jest.fn(), onToggleAutoplayNext: jest.fn(), onToggleFullscreen: jest.fn(), onToggleMinimize: jest.fn(),
    onOpenSettings: jest.fn(), onPip: jest.fn(), onSeekStart: jest.fn(), onSeekPreview: jest.fn(), onSeekCommit: jest.fn(), onSeekCancel: jest.fn(),
    testID: "overlay", ...overrides,
  };
}

describe("ControlsOverlay", () => {
  it("renders the three rows for a playing VOD", () => {
    render(<ControlsOverlay {...props()} />);
    expect(screen.getByLabelText("Minimize player")).toBeTruthy();
    expect(screen.getByLabelText("Autoplay on")).toBeTruthy();
    expect(screen.getByLabelText("Picture in picture")).toBeTruthy();
    expect(screen.getByLabelText("Settings")).toBeTruthy();
    expect(screen.getByLabelText("Previous video")).toBeTruthy();
    expect(screen.getByLabelText("Pause")).toBeTruthy();
    expect(screen.getByLabelText("Next video")).toBeTruthy();
    expect(screen.getByLabelText("Mute")).toBeTruthy();
    expect(screen.getByLabelText("Fullscreen")).toBeTruthy();
    expect(screen.getByLabelText("Seek")).toBeTruthy();
    expect(screen.queryByLabelText("Live")).toBeNull();
  });
  it("live: badge shown, progress hidden without a window, minimize hidden in fullscreen", () => {
    render(<ControlsOverlay {...props({ snapshot: liveSnapshot(0), layoutMode: "fullscreen" })} />);
    expect(screen.getByLabelText("Live")).toBeTruthy();
    expect(screen.queryByLabelText("Seek")).toBeNull();
    expect(screen.queryByLabelText("Minimize player")).toBeNull();
    expect(screen.getByLabelText("Exit fullscreen")).toBeTruthy();
  });
  it("hidden overlay blocks pointer events; visible overlay is box-none", () => {
    const { rerender } = render(<ControlsOverlay {...props({ visible: false })} />);
    expect(screen.getByTestId("overlay").props.pointerEvents).toBe("none");
    rerender(<ControlsOverlay {...props({ visible: true })} />);
    expect(screen.getByTestId("overlay").props.pointerEvents).toBe("box-none");
  });
  it("centre slot is empty in error (ErrorCard owns it)", () => {
    render(<ControlsOverlay {...props({ snapshot: errorSnapshot() })} />);
    expect(screen.queryByLabelText("Pause")).toBeNull();
    expect(screen.queryByLabelText("Play")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```tsx
// components/VideoPlayer/ui/ControlsOverlay.tsx
// Layout only. Positions: docs/player/06-ui-and-gestures-spec.md §2
import React, { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { ChapterItem } from "../../../types/domain";
import { currentChapter } from "../engine/pure/currentChapter";
import type { PlaybackCommands, PlaybackSnapshot } from "../engine/types";
import type { HapticsAdapter } from "../platform/types";
import { playerTokens } from "../tokens";
import { AutoplayToggle } from "./controls/AutoplayToggle";
import { FullscreenButton } from "./controls/FullscreenButton";
import { GoLiveButton } from "./controls/GoLiveButton";
import { LiveBadge } from "./controls/LiveBadge";
import { MinimizeButton } from "./controls/MinimizeButton";
import { MuteButton } from "./controls/MuteButton";
import { PipButton } from "./controls/PipButton";
import { PlayPauseButton } from "./controls/PlayPauseButton";
import { SettingsButton } from "./controls/SettingsButton";
import { SkipButton } from "./controls/SkipButton";
import { ProgressBar } from "./ProgressBar";
import { TimeLabel } from "./TimeLabel";

export interface ControlsOverlayProps {
  readonly snapshot: PlaybackSnapshot;
  readonly commands: PlaybackCommands;
  readonly visible: boolean;
  readonly opacity: SharedValue<number>;
  readonly layoutMode: "inline" | "fullscreen";
  readonly insets: EdgeInsets;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayNextEnabled: boolean;
  readonly chapters?: readonly ChapterItem[];
  readonly pipSupported: boolean;
  readonly haptics: HapticsAdapter;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onToggleAutoplayNext: (enabled: boolean) => void;
  readonly onToggleFullscreen: () => void;
  readonly onToggleMinimize: () => void;
  readonly onOpenSettings: () => void;
  readonly onPip: () => void;
  readonly onSeekStart: () => void;
  readonly onSeekPreview: (ms: number) => void;
  readonly onSeekCommit: (ms: number) => void;
  readonly onSeekCancel: () => void;
  readonly testID?: string;
}

export const ControlsOverlay = memo(function ControlsOverlay(props: ControlsOverlayProps) {
  const { snapshot, commands, visible, opacity, layoutMode, insets, chapters } = props;
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const isFullscreen = layoutMode === "fullscreen";
  const inset = useMemo(
    () => ({
      paddingTop: playerTokens.space.md + (isFullscreen ? insets.top : 0),
      paddingBottom: playerTokens.space.md + (isFullscreen ? insets.bottom : 0),
      paddingLeft: playerTokens.space.md + (isFullscreen ? insets.left : 0),
      paddingRight: playerTokens.space.md + (isFullscreen ? insets.right : 0),
    }),
    [insets, isFullscreen],
  );
  const chapterTitle = useMemo(() => (chapters ? currentChapter(chapters, snapshot.positionMs)?.title ?? null : null), [chapters, snapshot.positionMs]);

  return (
    <Animated.View style={[styles.overlay, inset, animatedStyle]} pointerEvents={visible ? "box-none" : "none"} testID={props.testID}>
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.side}>{isFullscreen ? null : <MinimizeButton onPress={props.onToggleMinimize} />}</View>
        <LiveBadge isLive={snapshot.isLive} />
        <View style={[styles.side, styles.right]}>
          <AutoplayToggle enabled={props.isAutoplayNextEnabled} hasNext={props.hasNext} onToggle={props.onToggleAutoplayNext} />
          <PipButton supported={props.pipSupported} onPress={props.onPip} />
          <SettingsButton onPress={props.onOpenSettings} />
        </View>
      </View>

      <View style={styles.centreRow} pointerEvents="box-none">
        <SkipButton direction="previous" enabled={props.hasPrevious} onPress={props.onPrevious} />
        <View style={styles.centreSlot}>
          <PlayPauseButton status={snapshot.status} commands={commands} />
        </View>
        <SkipButton direction="next" enabled={props.hasNext} onPress={props.onNext} />
      </View>

      <View pointerEvents="box-none">
        <View style={styles.bottomLine}>
          <TimeLabel positionMs={snapshot.positionMs} durationMs={snapshot.durationMs} isLive={snapshot.isLive} liveOffsetMs={snapshot.liveOffsetMs} chapterTitle={chapterTitle} />
          <View style={[styles.side, styles.right]}>
            <GoLiveButton isLive={snapshot.isLive} liveOffsetMs={snapshot.liveOffsetMs} commands={commands} />
            <MuteButton muted={snapshot.muted} commands={commands} />
            <FullscreenButton isFullscreen={isFullscreen} onToggle={props.onToggleFullscreen} />
          </View>
        </View>
        <ProgressBar
          positionMs={snapshot.positionMs}
          durationMs={snapshot.durationMs}
          bufferedMs={snapshot.bufferedMs}
          chapters={chapters}
          isLive={snapshot.isLive}
          disabled={!visible}
          onSeekStart={props.onSeekStart}
          onSeekPreview={props.onSeekPreview}
          onSeekCommit={props.onSeekCommit}
          onSeekCancel={props.onSeekCancel}
          haptics={props.haptics}
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "space-between", backgroundColor: playerTokens.color.scrim, zIndex: playerTokens.z.overlay },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { flexDirection: "row", alignItems: "center", minWidth: playerTokens.size.controlSm },
  right: { justifyContent: "flex-end" },
  centreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  centreSlot: { width: playerTokens.size.controlLg, height: playerTokens.size.controlLg, marginHorizontal: playerTokens.space.xl, alignItems: "center", justifyContent: "center" },
  bottomLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: playerTokens.size.minTouchTarget },
});
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern=ui/ControlsOverlay` → 4 passed. If `makeMutable` is not exported by the Reanimated mock, replace it in the test with `{ value: 1 } as unknown as SharedValue<number>`.

```bash
git add components/VideoPlayer/ui/ControlsOverlay.tsx __tests__/player/ui/ControlsOverlay.test.tsx
git commit -m "feat(player): add ControlsOverlay layout

Verified: npm test -- --testPathPattern=ui/ControlsOverlay => 4 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: useTapGestures

**Files:**
- Create: `gestures/useTapGestures.ts`
- Test: `__tests__/player/gestures/useTapGestures.test.tsx`

**Interfaces:**
```ts
export interface TapGesturesInput {
  readonly commands: PlaybackCommands; readonly enabled: boolean; readonly layout: { readonly width: number; readonly height: number };
  readonly haptics: HapticsAdapter; readonly onInteraction: () => void; readonly onToggleControls: () => void;
  readonly onSkipFeedback: (direction: "back" | "forward") => void; readonly onLongPressRate: (active: boolean) => void;
}
export function useTapGestures(input: TapGesturesInput): GestureType   // Gesture.Simultaneous(Gesture.Exclusive(doubleTap, singleTap), longPress)
export const TAP_GESTURE_TEST_IDS = { single: "player-tap", double: "player-double-tap", longPress: "player-long-press" }
```

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/player/gestures/useTapGestures.test.tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import { GestureDetector, State, type LongPressGesture, type TapGesture } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { TAP_GESTURE_TEST_IDS, useTapGestures, type TapGesturesInput } from "../../../components/VideoPlayer/gestures/useTapGestures";
import { SKIP_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

function Harness(props: TapGesturesInput) {
  const gesture = useTapGestures(props);
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: 300, height: 200 }} />
    </GestureDetector>
  );
}

function input(overrides: Partial<TapGesturesInput> = {}): TapGesturesInput {
  return {
    commands: commands(), enabled: true, layout: { width: 300, height: 200 }, haptics: { light: jest.fn() },
    onInteraction: jest.fn(), onToggleControls: jest.fn(), onSkipFeedback: jest.fn(), onLongPressRate: jest.fn(), ...overrides,
  };
}

describe("useTapGestures", () => {
  it("single tap toggles controls and counts as interaction", () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.single), [{ x: 150, y: 100 }]);
    expect(i.onToggleControls).toHaveBeenCalledTimes(1);
    expect(i.onInteraction).toHaveBeenCalledTimes(1);
  });
  it("double tap left third seeks back with haptic and feedback", () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.double), [{ x: 50, y: 100 }]);
    expect(i.commands.seekBy).toHaveBeenCalledWith(-SKIP_MS);
    expect(i.haptics.light).toHaveBeenCalledTimes(1);
    expect(i.onSkipFeedback).toHaveBeenCalledWith("back");
  });
  it("double tap right third seeks forward; centre third toggles play", () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.double), [{ x: 250, y: 100 }]);
    expect(i.commands.seekBy).toHaveBeenLastCalledWith(SKIP_MS);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.double), [{ x: 150, y: 100 }]);
    expect(i.commands.togglePlay).toHaveBeenCalledTimes(1);
  });
  it("long press toggles the rate flag on start and end", () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<LongPressGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.longPress), [
      { state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END },
    ]);
    expect(i.onLongPressRate.mock.calls).toEqual([[true], [false]]);
  });
  it("disabled: nothing fires", () => {
    const i = input({ enabled: false });
    render(<Harness {...i} />);
    fireGestureHandler<TapGesture>(getByGestureTestId(TAP_GESTURE_TEST_IDS.single), [{ x: 150, y: 100 }]);
    expect(i.onToggleControls).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```ts
// components/VideoPlayer/gestures/useTapGestures.ts
// Single tap, double tap zones, long press. Spec: 06 §4.1
import { useMemo } from "react";
import { Gesture, type GestureType } from "react-native-gesture-handler";
import { DOUBLE_TAP_WINDOW_MS, LONG_PRESS_MS, SKIP_MS } from "../constants";
import type { PlaybackCommands } from "../engine/types";
import type { HapticsAdapter } from "../platform/types";

export interface TapGesturesInput {
  readonly commands: PlaybackCommands;
  readonly enabled: boolean;
  readonly layout: { readonly width: number; readonly height: number };
  readonly haptics: HapticsAdapter;
  readonly onInteraction: () => void;
  readonly onToggleControls: () => void;
  readonly onSkipFeedback: (direction: "back" | "forward") => void;
  readonly onLongPressRate: (active: boolean) => void;
}

export const TAP_GESTURE_TEST_IDS = { single: "player-tap", double: "player-double-tap", longPress: "player-long-press" } as const;

const THIRDS = 3;

export function useTapGestures(input: TapGesturesInput): GestureType {
  const { commands, enabled, layout, haptics, onInteraction, onToggleControls, onSkipFeedback, onLongPressRate } = input;

  return useMemo(() => {
    const single = Gesture.Tap()
      .withTestId(TAP_GESTURE_TEST_IDS.single)
      .enabled(enabled)
      .runOnJS(true)
      .numberOfTaps(1)
      .maxDuration(DOUBLE_TAP_WINDOW_MS)
      .onEnd(() => {
        if (!enabled) return; // belt and braces: jest-utils may fire disabled handlers
        onToggleControls();
        onInteraction();
      });

    const double = Gesture.Tap()
      .withTestId(TAP_GESTURE_TEST_IDS.double)
      .enabled(enabled)
      .runOnJS(true)
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_WINDOW_MS)
      .onEnd((event) => {
        if (!enabled) return;
        const third = layout.width / THIRDS;
        if (event.x < third) {
          commands.seekBy(-SKIP_MS);
          haptics.light();
          onSkipFeedback("back");
        } else if (event.x > layout.width - third) {
          commands.seekBy(SKIP_MS);
          haptics.light();
          onSkipFeedback("forward");
        } else {
          commands.togglePlay();
        }
        onInteraction();
      });

    const longPress = Gesture.LongPress()
      .withTestId(TAP_GESTURE_TEST_IDS.longPress)
      .enabled(enabled)
      .runOnJS(true)
      .minDuration(LONG_PRESS_MS)
      .onStart(() => {
        if (enabled) onLongPressRate(true);
      })
      .onFinalize(() => {
        if (enabled) onLongPressRate(false);
      });

    return Gesture.Simultaneous(Gesture.Exclusive(double, single), longPress);
  }, [commands, enabled, layout.width, haptics, onInteraction, onToggleControls, onSkipFeedback, onLongPressRate]);
}
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern=gestures/useTapGestures` → 5 passed. If `onFinalize` fires twice for a long press in the jest utils (once for END), assert `[[true],[false]]` still holds; if it yields an extra `false`, change the implementation to `.onEnd(() => onLongPressRate(false))` plus `.onFinalize((_e, success) => { if (!success) onLongPressRate(false); })` and re-run.

```bash
git add components/VideoPlayer/gestures/useTapGestures.ts __tests__/player/gestures/useTapGestures.test.tsx
git commit -m "feat(player): add tap, double-tap zone and long-press gestures

Verified: npm test -- --testPathPattern=gestures/useTapGestures => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: useSwipeGestures

**Files:**
- Create: `gestures/useSwipeGestures.ts`
- Test: `__tests__/player/gestures/useSwipeGestures.test.tsx`

**Interfaces:**
```ts
export interface SwipeGesturesInput {
  readonly commands: PlaybackCommands; readonly enabled: boolean; readonly layout: { readonly width: number; readonly height: number };
  readonly brightness: BrightnessAdapter; readonly initialVolume: number;
  readonly onLevel: (level: SwipeLevel | null) => void;
}
export function useSwipeGestures(input: SwipeGesturesInput): GestureType
export const SWIPE_GESTURE_TEST_ID = "player-swipe"
```

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/player/gestures/useSwipeGestures.test.tsx
import React from "react";
import { act, render } from "@testing-library/react-native";
import { View } from "react-native";
import { GestureDetector, State, type PanGesture } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { SWIPE_GESTURE_TEST_ID, useSwipeGestures, type SwipeGesturesInput } from "../../../components/VideoPlayer/gestures/useSwipeGestures";
import { SWIPE_INDICATOR_HIDE_MS } from "../../../components/VideoPlayer/constants";
import type { PlaybackCommands } from "../../../components/VideoPlayer/engine/types";

const commands = (): PlaybackCommands => ({
  play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
  setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
  retry: jest.fn(), replay: jest.fn(),
});

function Harness(props: SwipeGesturesInput) {
  const gesture = useSwipeGestures(props);
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: 300, height: 200 }} />
    </GestureDetector>
  );
}
function input(overrides: Partial<SwipeGesturesInput> = {}): SwipeGesturesInput {
  return {
    commands: commands(), enabled: true, layout: { width: 300, height: 200 },
    brightness: { attach: jest.fn(), get: jest.fn().mockResolvedValue(0.5), set: jest.fn().mockResolvedValue({ ok: true }), restore: jest.fn() },
    initialVolume: 0.8, onLevel: jest.fn(), ...overrides,
  };
}
const flush = () => act(async () => Promise.resolve());

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useSwipeGestures", () => {
  it("right half adjusts volume from the initial value by -translationY/height", async () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<PanGesture>(getByGestureTestId(SWIPE_GESTURE_TEST_ID), [
      { state: State.BEGAN, x: 250, y: 100 },
      { state: State.ACTIVE, x: 250, translationY: -40 }, // +0.2
      { state: State.END, x: 250, translationY: -40 },
    ]);
    await flush();
    expect(i.commands.setVolume).toHaveBeenLastCalledWith(1);
    expect(i.onLevel).toHaveBeenCalledWith({ kind: "volume", level: 1 });
    act(() => jest.advanceTimersByTime(SWIPE_INDICATOR_HIDE_MS));
    expect(i.onLevel).toHaveBeenLastCalledWith(null);
  });
  it("left half adjusts brightness from the adapter's current value and clamps", async () => {
    const i = input();
    render(<Harness {...i} />);
    fireGestureHandler<PanGesture>(getByGestureTestId(SWIPE_GESTURE_TEST_ID), [
      { state: State.BEGAN, x: 50, y: 100 },
      { state: State.ACTIVE, x: 50, translationY: 400 }, // -2.0 → clamp 0
      { state: State.END, x: 50, translationY: 400 },
    ]);
    await flush();
    expect(i.brightness.get).toHaveBeenCalledTimes(1);
    expect(i.brightness.set).toHaveBeenLastCalledWith(0);
    expect(i.onLevel).toHaveBeenCalledWith({ kind: "brightness", level: 0 });
  });
  it("disabled: no commands", async () => {
    const i = input({ enabled: false });
    render(<Harness {...i} />);
    fireGestureHandler<PanGesture>(getByGestureTestId(SWIPE_GESTURE_TEST_ID), [{ state: State.BEGAN, x: 250 }, { state: State.ACTIVE, translationY: -40 }, { state: State.END }]);
    await flush();
    expect(i.commands.setVolume).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**, then implement:

```ts
// components/VideoPlayer/gestures/useSwipeGestures.ts
// Vertical pan: left half brightness, right half volume. Spec: 06 §4.2
import { useEffect, useMemo, useRef } from "react";
import { Gesture, type GestureType } from "react-native-gesture-handler";
import { SWIPE_ACTIVATION_PX, SWIPE_INDICATOR_HIDE_MS } from "../constants";
import { clamp } from "../engine/pure/clamp";
import type { PlaybackCommands } from "../engine/types";
import type { BrightnessAdapter } from "../platform/types";
import type { SwipeLevel } from "../ui/SwipeIndicator";

export interface SwipeGesturesInput {
  readonly commands: PlaybackCommands;
  readonly enabled: boolean;
  readonly layout: { readonly width: number; readonly height: number };
  readonly brightness: BrightnessAdapter;
  readonly initialVolume: number;
  readonly onLevel: (level: SwipeLevel | null) => void;
}

export const SWIPE_GESTURE_TEST_ID = "player-swipe";

export function useSwipeGestures(input: SwipeGesturesInput): GestureType {
  const { commands, enabled, layout, brightness, initialVolume, onLevel } = input;
  const sideRef = useRef<SwipeLevel["kind"]>("volume");
  const startLevelRef = useRef(initialVolume);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  return useMemo(
    () =>
      Gesture.Pan()
        .withTestId(SWIPE_GESTURE_TEST_ID)
        .enabled(enabled)
        .runOnJS(true)
        .activeOffsetY([-SWIPE_ACTIVATION_PX, SWIPE_ACTIVATION_PX])
        .failOffsetX([-SWIPE_ACTIVATION_PX, SWIPE_ACTIVATION_PX])
        .onBegin((event) => {
          if (hideTimerRef.current !== null) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
          const side: SwipeLevel["kind"] = event.x < layout.width / 2 ? "brightness" : "volume";
          sideRef.current = side;
          if (side === "volume") {
            startLevelRef.current = initialVolume;
          } else {
            startLevelRef.current = 1;
            brightness.get().then((level) => {
              startLevelRef.current = level;
            });
          }
        })
        .onUpdate((event) => {
          if (!enabled) return;
          const level = clamp(startLevelRef.current - event.translationY / Math.max(1, layout.height), 0, 1);
          if (sideRef.current === "volume") commands.setVolume(level);
          else void brightness.set(level);
          onLevel({ kind: sideRef.current, level });
        })
        .onFinalize(() => {
          hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            onLevel(null);
          }, SWIPE_INDICATOR_HIDE_MS);
        }),
    [brightness, commands, enabled, initialVolume, layout.height, layout.width, onLevel],
  );
}
```

- [ ] **Step 3: Run and commit**

Run: `npm test -- --testPathPattern=gestures/useSwipeGestures` → 3 passed. Note: the brightness `get()` resolves asynchronously; the test's `flush()` awaits it before the assertion on `set(0)`. If the first `onUpdate` runs before `get()` resolves, `startLevel` is 1 and the clamp still yields 0 for a 400 px downward swipe, so the assertion holds.

```bash
git add components/VideoPlayer/gestures/useSwipeGestures.ts __tests__/player/gestures/useSwipeGestures.test.tsx
git commit -m "feat(player): add brightness/volume swipe gesture

Verified: npm test -- --testPathPattern=gestures/useSwipeGestures => 3 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Activate R5 and R9, accessibility checklist, gate, report

**Files:**
- Modify: `__tests__/player/invariants.test.ts` (`ACTIVE_RULES` adds `"R5"`, `"R9"`)
- Create: `docs/superpowers/plans/2026-09-16-video-player-04-report.md`

- [ ] **Step 1: Activate rules**

```ts
const ACTIVE_RULES: readonly RuleId[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R9", "OLD_ROOT_FROZEN"];
```
Run: `npm test -- --testPathPattern=invariants` → 9 passed. If R9 flags a file over 200 lines (`ProgressBar.tsx` is the likely one), split its styles into `ui/ProgressBar.styles.ts` and re-run; do not raise the budget.

- [ ] **Step 2: Accessibility checklist**

For each component built in this increment, tick the checklist in `docs/player/06-ui-and-gestures-spec.md` §8 by confirming the test that proves it; list the results in the report as a table (component × checklist item → test name).

- [ ] **Step 3: Gate**

```bash
npm test 2>&1 | tail -6
npm run test:web 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

- [ ] **Step 4: Report**

Create `docs/superpowers/plans/2026-09-16-video-player-04-report.md` with the gate numbers, the accessibility table, any Reanimated/RNGH test-utility deviations (for example `makeMutable` availability, `onFinalize` behaviour), and "Not done: none" or the list.

- [ ] **Step 5: Commit**

```bash
git add __tests__/player/invariants.test.ts docs/superpowers/plans/2026-09-16-video-player-04-report.md
git commit -m "test(player): activate R5/R9 invariants; Increment 3 report

Verified: npm test => <N> suites passed
Verified: npm run lint => 0 errors

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Increment 3 exit criteria: §3.3 tests green, R5 and R6 active, accessibility checklist recorded. Merge to `main`; Increment 4 branches from `main`.
