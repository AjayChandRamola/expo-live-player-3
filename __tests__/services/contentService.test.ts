// __tests__/services/contentService.test.ts
import {
  getFeatured,
  getLatest,
  getVideoById,
  getVideosByIds,
  getRelated,
  search,
} from "../../services/contentService";
import { isAppError } from "../../services/appError";
import { LIMITS } from "../../constants/config";

jest.mock("../../services/contentSourceConfig", () => ({
  getContentSourceConfig: () => ({
    mode: "development",
    apiBaseUrl: "",
    allowedMediaHosts: [],
    liveSourceFallback: "youtube",
  }),
}));

describe("contentService in development mode", () => {
  it("returns a featured video", async () => {
    const featured = await getFeatured();
    expect(featured).not.toBeNull();
    expect(typeof featured?.id).toBe("string");
  });

  it("returns a first page no larger than the configured page size", async () => {
    const { videos, hasMore } = await getLatest(0);
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.length).toBeLessThanOrEqual(LIMITS.feedPageSize);
    expect(typeof hasMore).toBe("boolean");
  });

  it("returns a different page for a different index", async () => {
    const first = await getLatest(0);
    const second = await getLatest(1);
    if (second.videos.length > 0) {
      expect(second.videos[0].id).not.toBe(first.videos[0].id);
    }
  });

  it("returns an empty page past the end rather than throwing", async () => {
    const { videos, hasMore } = await getLatest(9999);
    expect(videos).toEqual([]);
    expect(hasMore).toBe(false);
  });

  it("finds a video by id", async () => {
    const { videos } = await getLatest(0);
    const found = await getVideoById(videos[0].id);
    expect(found.id).toBe(videos[0].id);
  });

  it("rejects an unknown id with not_found instead of falling back", async () => {
    try {
      await getVideoById("no-such-id");
      throw new Error("should have rejected");
    } catch (e) {
      expect(isAppError(e) && e.code).toBe("not_found");
    }
  });

  it("rejects an empty id with validation", async () => {
    try {
      await getVideoById("   ");
      throw new Error("should have rejected");
    } catch (e) {
      expect(isAppError(e) && e.code).toBe("validation");
    }
  });

  it("hydrates a list of ids and silently omits the ones it cannot find", async () => {
    const { videos } = await getLatest(0);
    const result = await getVideosByIds([videos[0].id, "missing", videos[1].id]);
    expect(result.map((v) => v.id)).toEqual([videos[0].id, videos[1].id]);
  });

  it("preserves the caller's order when hydrating ids", async () => {
    const { videos } = await getLatest(0);
    const result = await getVideosByIds([videos[2].id, videos[0].id]);
    expect(result.map((v) => v.id)).toEqual([videos[2].id, videos[0].id]);
  });

  it("returns an empty list for no ids without calling through", async () => {
    await expect(getVideosByIds([])).resolves.toEqual([]);
  });

  it("returns related videos that exclude the current one", async () => {
    const { videos } = await getLatest(0);
    const related = await getRelated(videos[0].id);
    expect(related.every((v) => v.id !== videos[0].id)).toBe(true);
    expect(related.length).toBeLessThanOrEqual(LIMITS.relatedCount);
  });

  it("matches a search query case-insensitively", async () => {
    const { videos } = await getLatest(0);
    const word = videos[0].title.split(" ")[0];
    const { videos: hits } = await search(word.toLowerCase(), 0);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("returns no results for a query that matches nothing", async () => {
    const { videos } = await search("zzzzzzzznomatch", 0);
    expect(videos).toEqual([]);
  });

  it("rejects a query shorter than the minimum with validation", async () => {
    try {
      await search("a", 0);
      throw new Error("should have rejected");
    } catch (e) {
      expect(isAppError(e) && e.code).toBe("validation");
    }
  });

  it("gives every video a source the resolver can accept", async () => {
    const { videos } = await getLatest(0);
    for (const video of videos) {
      expect(["hls", "mp4", "youtube"]).toContain(video.source.kind);
      expect(video.source.url.startsWith("https://")).toBe(true);
    }
  });
});
