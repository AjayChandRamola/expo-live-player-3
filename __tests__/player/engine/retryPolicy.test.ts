// __tests__/player/engine/retryPolicy.test.ts
import { nextRetryDelayMs } from "../../../components/VideoPlayer/engine/retryPolicy";
import type { PlaybackError } from "../../../components/VideoPlayer/engine/types";

const retryable: PlaybackError = { code: "network", message: "m", retryable: true };
const fatal: PlaybackError = { code: "unsupported", message: "m", retryable: false };

describe("nextRetryDelayMs", () => {
  it("returns 1s, 2s, 4s for attempts 0, 1, 2", () => {
    expect(nextRetryDelayMs(0, retryable)).toBe(1_000);
    expect(nextRetryDelayMs(1, retryable)).toBe(2_000);
    expect(nextRetryDelayMs(2, retryable)).toBe(4_000);
  });
  it("returns null after the last attempt", () => expect(nextRetryDelayMs(3, retryable)).toBeNull());
  it("returns null for non-retryable errors", () => expect(nextRetryDelayMs(0, fatal)).toBeNull());
  it("returns null for negative attempts", () => expect(nextRetryDelayMs(-1, retryable)).toBeNull());
});
