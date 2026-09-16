// __tests__/hooks/useVideoDetail.test.tsx
import { renderHook, waitFor } from "@testing-library/react-native";
import { useVideoDetail } from "../../hooks/useVideoDetail";
import * as contentService from "../../services/contentService";
import * as resolver from "../../services/mediaSourceResolver";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("../../services/contentService");
jest.mock("../../services/mediaSourceResolver");

const content = contentService as jest.Mocked<typeof contentService>;
const media = resolver as jest.Mocked<typeof resolver>;

const video: Video = {
  id: "v1",
  title: "Gayatri Yagya",
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 600,
  publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna" },
  isLive: false,
  source: { kind: "hls", url: "https://cdn.test/a.m3u8" },
};

describe("useVideoDetail", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns the video with its resolved source", async () => {
    content.getVideoById.mockResolvedValue(video);
    media.resolvePlayable.mockReturnValue({ kind: "hls", url: video.source.url });

    const { result } = renderHook(() => useVideoDetail("v1"));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.video.id).toBe("v1");
    expect(result.current.data?.source.url).toBe(video.source.url);
  });

  it("reports error with not_found for an unknown id", async () => {
    content.getVideoById.mockRejectedValue(makeError("not_found"));
    const { result } = renderHook(() => useVideoDetail("missing"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("not_found");
  });

  it("surfaces a resolver rejection rather than playing an unchecked url", async () => {
    content.getVideoById.mockResolvedValue(video);
    media.resolvePlayable.mockImplementation(() => {
      throw makeError("invalid_source");
    });

    const { result } = renderHook(() => useVideoDetail("v1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("invalid_source");
  });

  it("reports offline on a network failure", async () => {
    content.getVideoById.mockRejectedValue(makeError("network"));
    const { result } = renderHook(() => useVideoDetail("v1"));
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });

  it("stays idle and fetches nothing without an id", () => {
    const { result } = renderHook(() => useVideoDetail(undefined));
    expect(result.current.status).toBe("idle");
    expect(content.getVideoById).not.toHaveBeenCalled();
  });

  it("refetches when the id changes", async () => {
    content.getVideoById.mockResolvedValue(video);
    media.resolvePlayable.mockReturnValue({ kind: "hls", url: video.source.url });

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useVideoDetail(id),
      { initialProps: { id: "v1" } },
    );
    await waitFor(() => expect(content.getVideoById).toHaveBeenCalledWith("v1"));

    rerender({ id: "v2" });
    await waitFor(() => expect(content.getVideoById).toHaveBeenCalledWith("v2"));
  });
});
