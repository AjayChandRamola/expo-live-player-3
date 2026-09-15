// __tests__/hooks/useSearch.test.tsx
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useSearch } from "../../hooks/useSearch";
import * as contentService from "../../services/contentService";
import * as settingsStorage from "../../services/storage/settingsStorage";
import { makeError } from "../../services/appError";
import { TIMING, LIMITS } from "../../constants/config";
import type { Video } from "../../types/domain";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../services/contentService");
jest.mock("../../services/storage/settingsStorage");

const content = contentService as jest.Mocked<typeof contentService>;
const storage = settingsStorage as jest.Mocked<typeof settingsStorage>;

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

describe("useSearch", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    storage.readRecentSearches.mockResolvedValue([]);
    storage.writeRecentSearches.mockResolvedValue(undefined);
    content.search.mockResolvedValue({ videos: [video("a")], hasMore: false });
  });

  afterEach(() => jest.useRealTimers());

  it("starts idle with no query", () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.status).toBe("idle");
    expect(content.search).not.toHaveBeenCalled();
  });

  it("waits for the debounce before searching", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yagna"));
    expect(content.search).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(content.search).toHaveBeenCalledWith("yagna", 0));
  });

  it("issues one request for rapid typing", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => {
      result.current.setQuery("y");
      result.current.setQuery("ya");
      result.current.setQuery("yag");
    });
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(content.search).toHaveBeenCalledTimes(1));
    expect(content.search).toHaveBeenCalledWith("yag", 0);
  });

  it("does not search below the minimum query length", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("a"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    expect(content.search).not.toHaveBeenCalled();
  });

  it("returns to idle when the query is cleared", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yagna"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => result.current.setQuery(""));
    await waitFor(() => expect(result.current.status).toBe("idle"));
  });

  it("reports empty when nothing matches", async () => {
    content.search.mockResolvedValue({ videos: [], hasMore: false });
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("zzzz"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("reports offline on a network failure", async () => {
    content.search.mockRejectedValue(makeError("network"));
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yagna"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });

  it("strips control characters from the query", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yag" + String.fromCharCode(0) + "na"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(content.search).toHaveBeenCalledWith("yagna", 0));
  });

  it("caps the query at the configured maximum length", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("y".repeat(LIMITS.searchQueryMaxLength + 50)));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => {
      const sent = String(content.search.mock.calls[0][0]);
      expect(sent.length).toBeLessThanOrEqual(LIMITS.searchQueryMaxLength);
    });
  });

  it("records a committed query in recent searches, newest first", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yagna"));
    act(() => result.current.commit());
    await waitFor(() =>
      expect(storage.writeRecentSearches).toHaveBeenCalledWith(
        expect.arrayContaining(["yagna"]),
      ),
    );
  });

  it("does not record a duplicate recent query twice", async () => {
    storage.readRecentSearches.mockResolvedValue(["yagna"]);
    const { result } = renderHook(() => useSearch());
    await waitFor(() => expect(result.current.recent).toEqual(["yagna"]));

    act(() => result.current.setQuery("yagna"));
    act(() => result.current.commit());
    await waitFor(() => {
      const written = storage.writeRecentSearches.mock.calls.at(-1)?.[0] as string[];
      expect(written.filter((q) => q === "yagna")).toHaveLength(1);
    });
  });

  it("clears recent searches", async () => {
    storage.readRecentSearches.mockResolvedValue(["yagna"]);
    const { result } = renderHook(() => useSearch());
    await waitFor(() => expect(result.current.recent).toHaveLength(1));

    act(() => result.current.clearRecent());
    await waitFor(() => expect(result.current.recent).toEqual([]));
    expect(storage.writeRecentSearches).toHaveBeenCalledWith([]);
  });
});
