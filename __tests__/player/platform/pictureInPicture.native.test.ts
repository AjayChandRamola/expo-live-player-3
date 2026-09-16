// __tests__/player/platform/pictureInPicture.native.test.ts
import { Platform } from "react-native";
import { createPictureInPictureAdapter } from "../../../components/VideoPlayer/platform/pictureInPicture.native";

describe("picture-in-picture adapter (native)", () => {
  const original = { OS: Platform.OS, Version: Platform.Version };
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: original.OS, configurable: true });
    Object.defineProperty(Platform, "Version", { value: original.Version, configurable: true });
  });
  function setPlatform(os: string, version: number | string) {
    Object.defineProperty(Platform, "OS", { value: os, configurable: true });
    Object.defineProperty(Platform, "Version", { value: version, configurable: true });
  }

  it("is supported on iOS 14+ and Android 26+ only", () => {
    setPlatform("ios", "14.0");
    expect(createPictureInPictureAdapter().isSupported()).toBe(true);
    setPlatform("ios", "13.7");
    expect(createPictureInPictureAdapter().isSupported()).toBe(false);
    setPlatform("android", 26);
    expect(createPictureInPictureAdapter().isSupported()).toBe(true);
    setPlatform("android", 25);
    expect(createPictureInPictureAdapter().isSupported()).toBe(false);
  });

  it("start/stop call the view methods; missing view fails", async () => {
    const view = { startPictureInPicture: jest.fn().mockResolvedValue(undefined), stopPictureInPicture: jest.fn().mockResolvedValue(undefined) };
    const adapter = createPictureInPictureAdapter();
    await expect(adapter.start(view)).resolves.toEqual({ ok: true });
    await expect(adapter.stop(view)).resolves.toEqual({ ok: true });
    await expect(adapter.start({})).resolves.toEqual({ ok: false, reason: "no-view" });
  });

  it("maps a rejected start to fail(name)", async () => {
    const view = { startPictureInPicture: jest.fn().mockRejectedValue(new Error("x")) };
    await expect(createPictureInPictureAdapter().start(view)).resolves.toEqual({ ok: false, reason: "Error" });
  });

  it("subscribe is a no-op on native", () => {
    const unsubscribe = createPictureInPictureAdapter().subscribe({}, jest.fn());
    expect(typeof unsubscribe).toBe("function");
  });
});
