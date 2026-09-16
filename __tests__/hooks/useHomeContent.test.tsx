// __tests__/hooks/useHomeContent.test.tsx
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useHomeContent } from "../../hooks/useHomeContent";
import * as contentService from "../../services/contentService";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("../../services/contentService");

const mocked = contentService as jest.Mocked<typeof contentService>;

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

describe("useHomeContent", () => {
  beforeEach(() => jest.resetAllMocks());

  it("loads featured and latest together", async () => {
    mocked.getFeatured.mockResolvedValue(video("f1"));
    mocked.getLatest.mockResolvedValue({ videos: [video("a"), video("b")], hasMore: true });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data?.featured?.id).toBe("f1");
    expect(result.current.data?.latest).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it("still succeeds when only the featured section fails", async () => {
    mocked.getFeatured.mockRejectedValue(makeError("unknown"));
    mocked.getLatest.mockResolvedValue({ videos: [video("a")], hasMore: false });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.featured).toBeNull();
    expect(result.current.data?.latest).toHaveLength(1);
  });

  it("fails when the latest feed fails, because there is nothing to show", async () => {
    mocked.getFeatured.mockResolvedValue(video("f1"));
    mocked.getLatest.mockRejectedValue(makeError("unknown"));

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("reports offline when the feed fails with a network error", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest.mockRejectedValue(makeError("network"));

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });

  it("reports empty when the feed returns nothing", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest.mockResolvedValue({ videos: [], hasMore: false });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("appends the next page on loadMore", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest
      .mockResolvedValueOnce({ videos: [video("a")], hasMore: true })
      .mockResolvedValueOnce({ videos: [video("b")], hasMore: false });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.data?.latest).toHaveLength(1));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.latest).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
  });

  it("ignores loadMore when there is no more to load", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest.mockResolvedValue({ videos: [video("a")], hasMore: false });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("success"));

    const callsBefore = mocked.getLatest.mock.calls.length;
    act(() => result.current.loadMore());
    expect(mocked.getLatest.mock.calls.length).toBe(callsBefore);
  });

  it("does not issue a second page request while one is in flight", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest.mockResolvedValue({ videos: [video("a")], hasMore: true });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("success"));

    const before = mocked.getLatest.mock.calls.length;
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    await waitFor(() => expect(mocked.getLatest.mock.calls.length).toBe(before + 1));
  });
});
