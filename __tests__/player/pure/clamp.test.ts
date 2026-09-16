// __tests__/player/pure/clamp.test.ts
import { clamp } from "../../../components/VideoPlayer/engine/pure/clamp";

describe("clamp", () => {
  it("returns the value inside the range", () => expect(clamp(5, 0, 10)).toBe(5));
  it("clamps below", () => expect(clamp(-1, 0, 10)).toBe(0));
  it("clamps above", () => expect(clamp(11, 0, 10)).toBe(10));
  it("treats NaN as min", () => expect(clamp(Number.NaN, 0, 10)).toBe(0));
  it("handles min greater than max by returning min", () => expect(clamp(5, 10, 0)).toBe(10));
});
