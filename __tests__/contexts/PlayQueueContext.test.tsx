// __tests__/contexts/PlayQueueContext.test.tsx
import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { PlayQueueProvider, usePlayQueue } from "../../contexts/PlayQueueContext";
import type { Video } from "../../types/domain";

function video(id: string): Video {
  return {
    id,
    title: `Video ${id}`,
    thumbnailUrl: "https://cdn.test/t.jpg",
    durationSec: 60,
    publishedAt: "2026-01-01T00:00:00Z",
    channel: { id: "c1", name: "Yagna" },
    isLive: false,
    source: { kind: "mp4", url: "https://cdn.test/a.mp4" },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlayQueueProvider>{children}</PlayQueueProvider>
);

describe("PlayQueueContext", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    expect(result.current.queue).toEqual([]);
    expect(result.current.currentVideo).toBeNull();
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrevious).toBe(false);
  });

  it("selects the first video when no start id is given", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a"), video("b")]));
    expect(result.current.currentVideo?.id).toBe("a");
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrevious).toBe(false);
  });

  it("selects the requested start id", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a"), video("b"), video("c")], "b"));
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrevious).toBe(true);
  });

  it("falls back to the first entry when the start id is not in the queue", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a")], "missing"));
    expect(result.current.currentVideo?.id).toBe("a");
  });

  it("advances and retreats through the queue", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a"), video("b")]));

    act(() => {
      expect(result.current.playNext()).toBe(true);
    });
    expect(result.current.currentVideo?.id).toBe("b");

    act(() => {
      expect(result.current.playPrevious()).toBe(true);
    });
    expect(result.current.currentVideo?.id).toBe("a");
  });

  it("returns false at each end instead of wrapping", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a")]));

    act(() => {
      expect(result.current.playNext()).toBe(false);
      expect(result.current.playPrevious()).toBe(false);
    });
    expect(result.current.currentVideo?.id).toBe("a");
  });

  it("plays by id", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a"), video("b")]));
    act(() => result.current.playById("b"));
    expect(result.current.currentIndex).toBe(1);
  });

  it("ignores playById for an id that is not queued", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => result.current.setQueue([video("a")]));
    act(() => result.current.playById("nope"));
    expect(result.current.currentVideo?.id).toBe("a");
  });

  it("toggles autoplay, defaulting to on", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    expect(result.current.isAutoplayEnabled).toBe(true);
    act(() => result.current.setAutoplay(false));
    expect(result.current.isAutoplayEnabled).toBe(false);
  });

  it("handles an empty queue without throwing", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    act(() => {
      result.current.setQueue([]);
      expect(result.current.playNext()).toBe(false);
    });
    expect(result.current.currentVideo).toBeNull();
  });

  it("throws a clear error when used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => usePlayQueue())).toThrow(/PlayQueueProvider/);
    spy.mockRestore();
  });

  it("does not expose a home scroll position", () => {
    const { result } = renderHook(() => usePlayQueue(), { wrapper });
    expect(result.current).not.toHaveProperty("homeScrollPosition");
    expect(result.current).not.toHaveProperty("saveHomeScrollPosition");
  });
});
