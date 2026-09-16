// __tests__/player/platform/systemChrome.native.test.ts
import { StatusBar } from "react-native";
import { systemChromeAdapter } from "../../../components/VideoPlayer/platform/systemChrome.native";

describe("system chrome adapter (native)", () => {
  const setHidden = jest.spyOn(StatusBar, "setHidden").mockImplementation(() => undefined);
  beforeEach(() => setHidden.mockClear());

  it("hide/show toggle the status bar with a fade", async () => {
    await expect(systemChromeAdapter.hide()).resolves.toEqual({ ok: true });
    expect(setHidden).toHaveBeenLastCalledWith(true, "fade");
    await expect(systemChromeAdapter.show()).resolves.toEqual({ ok: true });
    expect(setHidden).toHaveBeenLastCalledWith(false, "fade");
  });

  it("maps a throwing StatusBar call to fail", async () => {
    setHidden.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    await expect(systemChromeAdapter.hide()).resolves.toEqual({ ok: false, reason: "Error" });
  });
});
