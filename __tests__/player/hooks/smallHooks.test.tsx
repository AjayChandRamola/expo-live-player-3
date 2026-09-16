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
