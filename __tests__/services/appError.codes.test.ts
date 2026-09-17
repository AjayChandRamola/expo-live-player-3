import { makeError } from "../../services/appError";
import { LIMITS, REPORT_REASONS, STORAGE_KEYS, THANKS_PRESETS, TIMING } from "../../constants/config";

describe("new error codes and constants", () => {
  it.each(["storage_full", "payments_unavailable", "unauthorized"] as const)("%s has a safe message", (code) => {
    const error = makeError(code);
    expect(error.code).toBe(code);
    expect(error.message.length).toBeGreaterThan(10);
  });
  it("defines the action constants", () => {
    expect(STORAGE_KEYS.videoActions).toBe("yagna.videoActions.v1");
    expect(STORAGE_KEYS.downloads).toBe("yagna.downloads.v1");
    expect(TIMING.downloadProgressThrottleMs).toBe(500);
    expect(LIMITS.maxConcurrentDownloads).toBe(1);
    expect(LIMITS.clipMinMs).toBeLessThan(LIMITS.clipMaxMs);
    expect(THANKS_PRESETS.length).toBeGreaterThan(0);
    expect(REPORT_REASONS).toContain("other");
  });
});
