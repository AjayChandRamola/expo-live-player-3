// __tests__/player/hooks/rootHooks.test.tsx
import { act, renderHook } from "@testing-library/react-native";
import type { createFakeAdapters } from "../fakes/fakeAdapters";

// jest.mock is hoisted above any local `const`, so the fake adapters are
// created inside the factory itself and captured into this outer binding.
let mockAdapters: ReturnType<typeof createFakeAdapters>;
jest.mock("../../../components/VideoPlayer/platform", () => {
  const { createFakeAdapters: create } = require("../fakes/fakeAdapters");
  mockAdapters = create();
  return {
    fullscreenAdapter: mockAdapters.fullscreen,
    orientationAdapter: mockAdapters.orientation,
    systemChromeAdapter: mockAdapters.systemChrome,
    keyboardAdapter: mockAdapters.keyboard,
    pictureInPictureAdapter: mockAdapters.pictureInPicture,
    brightnessAdapter: mockAdapters.brightness,
    hapticsAdapter: mockAdapters.haptics,
  };
});

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
