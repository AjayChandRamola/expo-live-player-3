// __tests__/services/shareLinkService.test.ts
import { forVideo, forLive } from "../../services/shareLinkService";
import { LINKS } from "../../constants/config";

describe("shareLinkService", () => {
  it("builds a video link on the app scheme", () => {
    expect(forVideo("abc123")).toBe(`${LINKS.scheme}://${LINKS.videoPath}/abc123`);
  });

  it("builds the live link", () => {
    expect(forLive()).toBe(`${LINKS.scheme}://${LINKS.livePath}`);
  });

  it("percent-encodes an id containing separators", () => {
    const link = forVideo("a/b c");
    expect(link).not.toContain(" ");
    expect(link).toContain("a%2Fb%20c");
  });

  it("encodes an id that tries to traverse the path", () => {
    const link = forVideo("../../admin");
    expect(link).not.toContain("../");
  });

  it("encodes an id carrying a query separator", () => {
    expect(forVideo("a?b=c")).not.toContain("?b=");
  });
});
