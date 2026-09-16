// __tests__/services/deepLinkService.test.ts
import { parseDeepLink } from "../../services/deepLinkService";
import { LINKS } from "../../constants/config";

const S = LINKS.scheme;

describe("parseDeepLink", () => {
  it("parses a video link", () => {
    expect(parseDeepLink(`${S}://video/abc123`)).toEqual({ kind: "video", id: "abc123" });
  });

  it("parses the live link", () => {
    expect(parseDeepLink(`${S}://live`)).toEqual({ kind: "live" });
  });

  it("decodes a percent-encoded id", () => {
    expect(parseDeepLink(`${S}://video/a%20b`)).toEqual({ kind: "home" });
  });

  it.each([
    [""],
    ["not a url"],
    [`${S}://`],
    [`${S}://video`],
    [`${S}://video/`],
    [`${S}://unknown/path`],
    ["https://evil.test/video/abc"],
    ["javascript:alert(1)"],
    [`${S}://video/${"x".repeat(500)}`],
  ])("falls back to home for %p", (url) => {
    expect(parseDeepLink(url)).toEqual({ kind: "home" });
  });

  it("rejects an id that tries to traverse the path", () => {
    expect(parseDeepLink(`${S}://video/..%2F..%2Fadmin`)).toEqual({ kind: "home" });
  });

  it("rejects a foreign scheme even with a valid-looking path", () => {
    expect(parseDeepLink("otherapp://video/abc123")).toEqual({ kind: "home" });
  });
});
