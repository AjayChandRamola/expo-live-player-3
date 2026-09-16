// __tests__/player/platform/systemChrome.web.test.ts
import { systemChromeAdapter } from "../../../components/VideoPlayer/platform/systemChrome.web";

describe("system chrome adapter (web)", () => {
  it("is a no-op that succeeds", async () => {
    await expect(systemChromeAdapter.hide()).resolves.toEqual({ ok: true });
    await expect(systemChromeAdapter.show()).resolves.toEqual({ ok: true });
  });
});
