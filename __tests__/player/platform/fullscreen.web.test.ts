// __tests__/player/platform/fullscreen.web.test.ts
import { createFullscreenAdapter } from "../../../components/VideoPlayer/platform/fullscreen.web";

function setFullscreenEnabled(value: boolean) {
  Object.defineProperty(document, "fullscreenEnabled", { value, configurable: true });
}
function setFullscreenElement(value: Element | null) {
  Object.defineProperty(document, "fullscreenElement", { value, configurable: true });
}

describe("fullscreen adapter (web)", () => {
  let el: HTMLDivElement;
  beforeEach(() => {
    el = document.createElement("div");
    el.requestFullscreen = jest.fn().mockResolvedValue(undefined);
    document.exitFullscreen = jest.fn().mockResolvedValue(undefined);
    setFullscreenEnabled(true);
    setFullscreenElement(null);
  });

  it("fails when the Fullscreen API is unavailable", async () => {
    setFullscreenEnabled(false);
    await expect(createFullscreenAdapter().enter({ getElement: () => el })).resolves.toEqual({ ok: false, reason: "unsupported" });
  });

  it("fails without an element", async () => {
    await expect(createFullscreenAdapter().enter({ getElement: () => null })).resolves.toEqual({ ok: false, reason: "no-element" });
    await expect(createFullscreenAdapter().enter()).resolves.toEqual({ ok: false, reason: "no-element" });
  });

  it("requests fullscreen on the element and reports isActive from the document", async () => {
    const adapter = createFullscreenAdapter();
    await expect(adapter.enter({ getElement: () => el })).resolves.toEqual({ ok: true });
    expect(el.requestFullscreen).toHaveBeenCalledTimes(1);
    setFullscreenElement(el);
    expect(adapter.isActive()).toBe(true);
  });

  it("maps a rejected request to fail(name)", async () => {
    el.requestFullscreen = jest.fn().mockRejectedValue(new TypeError("nope"));
    await expect(createFullscreenAdapter().enter({ getElement: () => el })).resolves.toEqual({ ok: false, reason: "TypeError" });
  });

  it("exit is idempotent and calls document.exitFullscreen only when active", async () => {
    const adapter = createFullscreenAdapter();
    await expect(adapter.exit()).resolves.toEqual({ ok: true });
    expect(document.exitFullscreen).not.toHaveBeenCalled();
    setFullscreenElement(el);
    await adapter.exit();
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("subscribe mirrors fullscreenchange and unsubscribes", () => {
    const adapter = createFullscreenAdapter();
    const listener = jest.fn();
    const unsubscribe = adapter.subscribe(listener);
    setFullscreenElement(el);
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(listener).toHaveBeenCalledWith(true);
    unsubscribe();
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
