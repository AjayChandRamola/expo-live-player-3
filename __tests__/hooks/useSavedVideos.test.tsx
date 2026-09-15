// __tests__/hooks/useSavedVideos.test.tsx
import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useSavedVideos } from "../../hooks/useSavedVideos";
import * as contentService from "../../services/contentService";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("../../services/contentService");
const content = contentService as jest.Mocked<typeof contentService>;

let mockSavedIds: string[] = [];
let mockHydrated = true;
jest.mock("../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds: mockSavedIds,
    hydrated: mockHydrated,
    isSaved: (id: string) => mockSavedIds.includes(id),
    isLiked: () => false,
    toggleSave: jest.fn(),
    toggleLike: jest.fn(),
  }),
}));

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

describe("useSavedVideos", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockSavedIds = [];
    mockHydrated = true;
  });

  it("reports empty when nothing is saved", async () => {
    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(content.getVideosByIds).not.toHaveBeenCalled();
  });

  it("hydrates saved ids into videos", async () => {
    mockSavedIds = ["a", "b"];
    content.getVideosByIds.mockResolvedValue([video("a"), video("b")]);

    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.missingIds).toEqual([]);
  });

  it("preserves the saved order", async () => {
    mockSavedIds = ["b", "a"];
    content.getVideosByIds.mockResolvedValue([video("b"), video("a")]);

    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.map((v) => v.id)).toEqual(["b", "a"]);
  });

  it("reports ids the catalogue no longer has", async () => {
    mockSavedIds = ["a", "gone", "b"];
    content.getVideosByIds.mockResolvedValue([video("a"), video("b")]);

    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.missingIds).toEqual(["gone"]);
  });

  it("stays idle until the saved store has hydrated", () => {
    mockHydrated = false;
    mockSavedIds = ["a"];
    const { result } = renderHook(() => useSavedVideos());
    expect(result.current.status).toBe("idle");
    expect(content.getVideosByIds).not.toHaveBeenCalled();
  });

  it("reports offline when hydration fails on the network", async () => {
    mockSavedIds = ["a"];
    content.getVideosByIds.mockRejectedValue(makeError("network"));
    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });
});
