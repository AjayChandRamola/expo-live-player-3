// __tests__/player/platform/keyboard.web.test.ts
import { keyboardAdapter, mapKeyEvent } from "../../../components/VideoPlayer/platform/keyboard.web";

function key(k: string, extra: Partial<KeyboardEventInit> = {}) {
  return new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra });
}

describe("mapKeyEvent", () => {
  it.each([
    [" ", "togglePlay"], ["k", "togglePlay"], ["K", "togglePlay"],
    ["f", "fullscreen"], ["m", "mute"], ["Escape", "exit"],
    ["ArrowLeft", "seekBack5"], ["ArrowRight", "seekForward5"], ["j", "seekBack10"], ["l", "seekForward10"],
    ["0", "seekPercent0"], ["5", "seekPercent5"], ["9", "seekPercent9"],
    ["c", "captions"],
  ])("maps %p to %p", (k, expected) => {
    expect(mapKeyEvent(key(k))).toBe(expected);
  });
  it("maps shift+comma/period to rate keys", () => {
    expect(mapKeyEvent(key("<", { shiftKey: true }))).toBe("rateDown");
    expect(mapKeyEvent(key(">", { shiftKey: true }))).toBe("rateUp");
  });
  it("ignores unmapped keys and keys with ctrl/meta/alt", () => {
    expect(mapKeyEvent(key("x"))).toBeNull();
    expect(mapKeyEvent(key("k", { ctrlKey: true }))).toBeNull();
    expect(mapKeyEvent(key("k", { metaKey: true }))).toBeNull();
    expect(mapKeyEvent(key("k", { altKey: true }))).toBeNull();
  });
});

describe("keyboard adapter (web)", () => {
  it("dispatches mapped keys, prevents default, and unsubscribes", () => {
    const handler = jest.fn();
    const unsubscribe = keyboardAdapter.subscribe(handler);
    const event = key("f");
    window.dispatchEvent(event);
    expect(handler).toHaveBeenCalledWith("fullscreen");
    expect(event.defaultPrevented).toBe(true);
    unsubscribe();
    window.dispatchEvent(key("f"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores keys typed into inputs, textareas and contenteditable", () => {
    const handler = jest.fn();
    const unsubscribe = keyboardAdapter.subscribe(handler);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(key("k"));
    const editable = document.createElement("div");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.appendChild(editable);
    editable.dispatchEvent(key("k"));
    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does not prevent default for unmapped keys", () => {
    const unsubscribe = keyboardAdapter.subscribe(jest.fn());
    const event = key("x");
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    unsubscribe();
  });

  it("subscribeHover listens to mousemove on the element", () => {
    const el = document.createElement("div");
    const onHover = jest.fn();
    const unsubscribe = keyboardAdapter.subscribeHover({ getElement: () => el }, onHover);
    el.dispatchEvent(new MouseEvent("mousemove"));
    expect(onHover).toHaveBeenCalledTimes(1);
    unsubscribe();
    el.dispatchEvent(new MouseEvent("mousemove"));
    expect(onHover).toHaveBeenCalledTimes(1);
  });
});
