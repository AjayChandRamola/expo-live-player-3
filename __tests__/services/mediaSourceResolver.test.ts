// __tests__/services/mediaSourceResolver.test.ts
import { resolvePlayable, resolveEmbed } from "../../services/mediaSourceResolver";
import { isAppError } from "../../services/appError";
import type { Video, LiveSession, SourceDescriptor } from "../../types/domain";

function videoWith(source: SourceDescriptor): Video {
  return {
    id: "v1",
    title: "Test",
    thumbnailUrl: "https://cdn.test/t.jpg",
    durationSec: 10,
    publishedAt: "2026-01-01T00:00:00Z",
    channel: { id: "c1", name: "Channel" },
    isLive: false,
    source,
  };
}

function sessionWith(source: SourceDescriptor): LiveSession {
  return {
    id: "s1",
    title: "Live",
    thumbnailUrl: "https://cdn.test/t.jpg",
    startsAt: "2026-01-01T00:00:00Z",
    source,
  };
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return isAppError(e) ? e.code : "not-an-app-error";
  }
  return "did-not-throw";
}

describe("resolvePlayable", () => {
  it("accepts an HTTPS HLS url", () => {
    const result = resolvePlayable(
      videoWith({ kind: "hls", url: "https://cdn.test/stream.m3u8" }),
    );
    expect(result).toEqual({ kind: "hls", url: "https://cdn.test/stream.m3u8" });
  });

  it("accepts an HTTPS MP4 url", () => {
    const result = resolvePlayable(
      videoWith({ kind: "mp4", url: "https://cdn.test/movie.mp4" }),
    );
    expect(result.kind).toBe("mp4");
  });

  it("accepts a url with a query string when the path extension is valid", () => {
    const result = resolvePlayable(
      videoWith({ kind: "hls", url: "https://cdn.test/stream.m3u8?token=abc" }),
    );
    expect(result.url).toContain("stream.m3u8");
  });

  it("rejects plain HTTP", () => {
    expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url: "http://cdn.test/a.mp4" }))))
      .toBe("invalid_source");
  });

  it.each([
    ["javascript:alert(1)"],
    ["file:///etc/passwd"],
    ["data:video/mp4;base64,AAAA"],
    ["ftp://cdn.test/a.mp4"],
  ])("rejects the dangerous scheme %s", (url) => {
    expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url })))).toBe("invalid_source");
  });

  it.each([[""], ["   "], ["not a url"], ["//cdn.test/a.mp4"]])(
    "rejects the malformed url %p",
    (url) => {
      expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url })))).toBe("invalid_source");
    },
  );

  it("rejects an extension it cannot play", () => {
    expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url: "https://cdn.test/a.mkv" }))))
      .toBe("unsupported_source");
  });

  it("refuses to hand a youtube source to the player", () => {
    expect(
      codeOf(() =>
        resolvePlayable(videoWith({ kind: "youtube", url: "https://youtube.com/watch?v=abc" })),
      ),
    ).toBe("unsupported_source");
  });

  it("resolves a live session the same way as a video", () => {
    const result = resolvePlayable(sessionWith({ kind: "hls", url: "https://cdn.test/live.m3u8" }));
    expect(result.kind).toBe("hls");
  });

  it("trusts the declared kind over the extension when they disagree", () => {
    const result = resolvePlayable(videoWith({ kind: "hls", url: "https://cdn.test/a.mp4" }));
    expect(result.kind).toBe("hls");
  });
});

describe("resolveEmbed", () => {
  it("builds a no-cookie embed url from a youtube watch link", () => {
    const target = resolveEmbed(
      sessionWith({ kind: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk" }),
    );
    expect(target.embedUrl).toContain("youtube-nocookie.com/embed/abcdefghijk");
  });

  it("accepts a youtu.be short link with a valid 11-char id", () => {
    const target = resolveEmbed(sessionWith({ kind: "youtube", url: "https://youtu.be/abcdefghijk" }));
    expect(target.embedUrl).toContain("abcdefghijk");
  });

  it("returns the origin allowlist the WebView must enforce", () => {
    const target = resolveEmbed(
      sessionWith({ kind: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk" }),
    );
    expect(target.allowedOrigins.length).toBeGreaterThan(0);
    for (const origin of target.allowedOrigins) {
      expect(origin.startsWith("https://")).toBe(true);
    }
  });

  it("rejects a non-youtube source", () => {
    expect(codeOf(() => resolveEmbed(sessionWith({ kind: "hls", url: "https://cdn.test/a.m3u8" }))))
      .toBe("unsupported_source");
  });

  it("rejects a look-alike host", () => {
    expect(
      codeOf(() =>
        resolveEmbed(sessionWith({ kind: "youtube", url: "https://youtube.evil.test/watch?v=abcdefghijk" })),
      ),
    ).toBe("invalid_source");
  });

  it("rejects a youtube url with no video id", () => {
    expect(
      codeOf(() => resolveEmbed(sessionWith({ kind: "youtube", url: "https://www.youtube.com/" }))),
    ).toBe("invalid_source");
  });

  it("rejects a video id of the wrong length", () => {
    expect(
      codeOf(() =>
        resolveEmbed(sessionWith({ kind: "youtube", url: "https://youtu.be/abc" })),
      ),
    ).toBe("invalid_source");
  });
});
