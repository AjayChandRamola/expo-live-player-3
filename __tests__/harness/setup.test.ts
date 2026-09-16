// __tests__/harness/setup.test.ts
// Proves the shared setup file registers the native-module mocks every
// player test relies on. If this fails, the setup file is not wired into
// package.json jest.setupFilesAfterEnv.
import * as ScreenOrientation from "expo-screen-orientation";
import * as Brightness from "expo-brightness";
import * as Haptics from "expo-haptics";

describe("shared jest setup", () => {
  it("mocks expo-screen-orientation lockAsync as a resolved jest.fn", async () => {
    await expect(
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
    ).resolves.toBeUndefined();
    expect(jest.isMockFunction(ScreenOrientation.lockAsync)).toBe(true);
  });

  it("mocks expo-brightness get/set", async () => {
    await expect(Brightness.getBrightnessAsync()).resolves.toBe(0.5);
    await expect(Brightness.setBrightnessAsync(0.2)).resolves.toBeUndefined();
  });

  it("mocks expo-haptics impactAsync", async () => {
    await expect(
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    ).resolves.toBeUndefined();
  });
});
