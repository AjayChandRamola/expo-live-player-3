// __tests__/player/platform/smoke.web.test.ts
// Proves the web Jest project runs in jsdom and resolves the web platform.
import { Platform } from "react-native";

describe("web jest project", () => {
  it("runs in a DOM environment", () => {
    expect(typeof document).toBe("object");
    expect(typeof document.createElement).toBe("function");
  });

  it("resolves Platform.OS to web", () => {
    expect(Platform.OS).toBe("web");
  });
});
