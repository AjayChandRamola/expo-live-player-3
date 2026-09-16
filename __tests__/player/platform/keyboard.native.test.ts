// __tests__/player/platform/keyboard.native.test.ts
import { keyboardAdapter } from "../../../components/VideoPlayer/platform/keyboard.native";

describe("keyboard adapter (native)", () => {
  it("subscribe returns an unsubscribe and never calls the handler", () => {
    const handler = jest.fn();
    const unsubscribe = keyboardAdapter.subscribe(handler);
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
    expect(handler).not.toHaveBeenCalled();
  });
  it("subscribeHover is a no-op", () => {
    const unsubscribe = keyboardAdapter.subscribeHover({ getElement: () => null }, jest.fn());
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
  });
});
