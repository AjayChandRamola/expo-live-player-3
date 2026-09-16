// __tests__/player/platform/haptics.native.test.ts
import * as Haptics from "expo-haptics";
import { hapticsAdapter } from "../../../components/VideoPlayer/platform/haptics.native";

describe("haptics adapter (native)", () => {
  it("fires a light impact and swallows rejections", async () => {
    const impact = Haptics.impactAsync as jest.Mock;
    impact.mockRejectedValueOnce(new Error("no haptics"));
    expect(() => hapticsAdapter.light()).not.toThrow();
    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    await Promise.resolve();
  });
});
