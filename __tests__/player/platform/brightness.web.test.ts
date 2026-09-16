// __tests__/player/platform/brightness.web.test.ts
import { createBrightnessAdapter } from "../../../components/VideoPlayer/platform/brightness.web";

describe("brightness adapter (web)", () => {
  it("applies a CSS brightness filter to the attached element and restores it", async () => {
    const el = document.createElement("div");
    const adapter = createBrightnessAdapter();
    adapter.attach({ getElement: () => el });
    await expect(adapter.get()).resolves.toBe(1);
    await expect(adapter.set(0.4)).resolves.toEqual({ ok: true });
    expect(el.style.filter).toBe("brightness(0.4)");
    await expect(adapter.get()).resolves.toBe(0.4);
    await adapter.restore();
    expect(el.style.filter).toBe("");
  });

  it("set without an attached element fails", async () => {
    await expect(createBrightnessAdapter().set(0.5)).resolves.toEqual({ ok: false, reason: "no-element" });
  });
});
