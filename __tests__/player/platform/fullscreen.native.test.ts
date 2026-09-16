// __tests__/player/platform/fullscreen.native.test.ts
import { createFullscreenAdapter } from "../../../components/VideoPlayer/platform/fullscreen.native";

describe("fullscreen adapter (native)", () => {
  it("enter/exit flip isActive and notify listeners once per change", async () => {
    const adapter = createFullscreenAdapter();
    const listener = jest.fn();
    const unsubscribe = adapter.subscribe(listener);
    expect(adapter.isActive()).toBe(false);
    await expect(adapter.enter()).resolves.toEqual({ ok: true });
    expect(adapter.isActive()).toBe(true);
    await adapter.enter(); // idempotent
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(adapter.exit()).resolves.toEqual({ ok: true });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(false);
    unsubscribe();
    await adapter.enter();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
