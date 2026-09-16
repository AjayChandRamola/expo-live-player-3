// __tests__/player/platform/orientation.web.test.ts
import { createOrientationAdapter } from "../../../components/VideoPlayer/platform/orientation.web";

describe("orientation adapter (web)", () => {
  it("fails to lock when screen.orientation.lock is unavailable", async () => {
    Object.defineProperty(window.screen, "orientation", { value: {}, configurable: true });
    await expect(createOrientationAdapter().lock("landscape")).resolves.toEqual({ ok: false, reason: "unsupported" });
  });

  it("locks and unlocks through screen.orientation when available", async () => {
    const lock = jest.fn().mockResolvedValue(undefined);
    const unlock = jest.fn();
    Object.defineProperty(window.screen, "orientation", { value: { lock, unlock }, configurable: true });
    const adapter = createOrientationAdapter();
    await expect(adapter.lock("landscape")).resolves.toEqual({ ok: true });
    expect(lock).toHaveBeenCalledWith("landscape");
    await expect(adapter.unlock()).resolves.toEqual({ ok: true });
    expect(unlock).toHaveBeenCalled();
  });

  it("subscribe uses matchMedia for portrait changes", () => {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    const mql = {
      matches: true,
      addEventListener: jest.fn((_: string, l: (e: { matches: boolean }) => void) => listeners.push(l)),
      removeEventListener: jest.fn(),
    };
    window.matchMedia = jest.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
    const listener = jest.fn();
    const unsubscribe = createOrientationAdapter().subscribe(listener);
    listeners[0]({ matches: false });
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});
