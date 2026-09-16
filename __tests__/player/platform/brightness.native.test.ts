// __tests__/player/platform/brightness.native.test.ts
import * as Brightness from "expo-brightness";
import { createBrightnessAdapter } from "../../../components/VideoPlayer/platform/brightness.native";

const getBrightnessAsync = Brightness.getBrightnessAsync as jest.Mock;
const setBrightnessAsync = Brightness.setBrightnessAsync as jest.Mock;

describe("brightness adapter (native)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBrightnessAsync.mockResolvedValue(0.5);
  });

  it("get reads the level and remembers the first value", async () => {
    const adapter = createBrightnessAdapter();
    await expect(adapter.get()).resolves.toBe(0.5);
    getBrightnessAsync.mockResolvedValue(0.9);
    await adapter.get();
    await adapter.restore();
    expect(setBrightnessAsync).toHaveBeenLastCalledWith(0.5);
  });

  it("set clamps to 0..1", async () => {
    const adapter = createBrightnessAdapter();
    await expect(adapter.set(1.7)).resolves.toEqual({ ok: true });
    expect(setBrightnessAsync).toHaveBeenLastCalledWith(1);
    await adapter.set(-3);
    expect(setBrightnessAsync).toHaveBeenLastCalledWith(0);
  });

  it("restore without a prior get is a no-op success", async () => {
    await expect(createBrightnessAdapter().restore()).resolves.toEqual({ ok: true });
    expect(setBrightnessAsync).not.toHaveBeenCalled();
  });

  it("maps failures", async () => {
    setBrightnessAsync.mockRejectedValueOnce(new Error("denied"));
    await expect(createBrightnessAdapter().set(0.3)).resolves.toEqual({ ok: false, reason: "Error" });
    getBrightnessAsync.mockRejectedValueOnce(new Error("x"));
    await expect(createBrightnessAdapter().get()).resolves.toBe(1);
  });
});
