// __tests__/player/platform/haptics.web.test.ts
import { hapticsAdapter } from "../../../components/VideoPlayer/platform/haptics.web";

describe("haptics adapter (web)", () => {
  it("is a no-op", () => expect(() => hapticsAdapter.light()).not.toThrow());
});
