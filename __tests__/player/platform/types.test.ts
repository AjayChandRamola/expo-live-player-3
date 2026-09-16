// __tests__/player/platform/types.test.ts
import { fail, ok, reasonOf } from "../../../components/VideoPlayer/platform/types";

describe("adapter result helpers", () => {
  it("ok is a frozen success", () => expect(ok).toEqual({ ok: true }));
  it("fail carries a reason", () => expect(fail("unsupported")).toEqual({ ok: false, reason: "unsupported" }));
  it("reasonOf uses the error name, falls back to unknown", () => {
    expect(reasonOf(new TypeError("x"))).toBe("TypeError");
    expect(reasonOf("string")).toBe("unknown");
    expect(reasonOf(undefined)).toBe("unknown");
  });
});
