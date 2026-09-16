// __tests__/player/pure/formatTime.test.ts
import { formatTime } from "../../../components/VideoPlayer/engine/pure/formatTime";

describe("formatTime", () => {
  it("formats zero", () => expect(formatTime(0)).toBe("0:00"));
  it("formats seconds with zero padding", () => expect(formatTime(59_000)).toBe("0:59"));
  it("formats minutes", () => expect(formatTime(61_000)).toBe("1:01"));
  it("formats hours with two-digit minutes", () => expect(formatTime(3_600_000 + 5_000)).toBe("1:00:05"));
  it("floors fractional seconds", () => expect(formatTime(1_999)).toBe("0:01"));
  it("treats negative and NaN as zero", () => {
    expect(formatTime(-5_000)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });
});
