// __tests__/services/appError.test.ts
import { makeError, isAppError, toAppError } from "../../services/appError";
import type { AppErrorCode } from "../../types/result";

const ALL_CODES: AppErrorCode[] = [
  "network",
  "timeout",
  "not_found",
  "invalid_source",
  "unsupported_source",
  "storage",
  "validation",
  "unknown",
];

describe("appError", () => {
  it("produces a safe message for every code", () => {
    for (const code of ALL_CODES) {
      const err = makeError(code);
      expect(err.code).toBe(code);
      expect(typeof err.message).toBe("string");
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  it("never leaks a URL, stack, or code identifier into the user message", () => {
    for (const code of ALL_CODES) {
      const { message } = makeError(code, new Error("https://secret.test/a?token=abc"));
      expect(message).not.toMatch(/https?:\/\//);
      expect(message).not.toContain("token");
      expect(message).not.toContain("Error:");
    }
  });

  it("keeps the cause for logging without rendering it", () => {
    const cause = new Error("boom");
    expect(makeError("network", cause).cause).toBe(cause);
  });

  it("recognises its own shape", () => {
    expect(isAppError(makeError("timeout"))).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError("string")).toBe(false);
    expect(isAppError({})).toBe(false);
  });

  it("passes an AppError through toAppError unchanged", () => {
    const original = makeError("not_found");
    expect(toAppError(original)).toBe(original);
  });

  it("wraps anything else as unknown", () => {
    const wrapped = toAppError(new Error("surprise"));
    expect(wrapped.code).toBe("unknown");
    expect(wrapped.cause).toBeInstanceOf(Error);
  });
});
