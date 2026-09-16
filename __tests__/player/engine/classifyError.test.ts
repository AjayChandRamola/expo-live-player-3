// __tests__/player/engine/classifyError.test.ts
import { classifyError, stripQuery } from "../../../components/VideoPlayer/engine/classifyError";
import { ERROR_MESSAGES } from "../../../components/VideoPlayer/constants";

describe("classifyError", () => {
  it.each([
    ["HTTP 403 Forbidden", "expired"],
    ["Token expired for asset", "expired"],
    ["Unsupported codec avc3", "unsupported"],
    ["Unknown MIME type", "unsupported"],
    ["Network timed out", "network"],
    ["Could not connect to host", "network"],
    ["NSURLErrorDomain -1009", "network"],
    ["Decoder init failed", "decode"],
    ["Something odd", "unknown"],
  ] as const)("maps %p to %p", (message, code) => {
    const error = classifyError(message);
    expect(error.code).toBe(code);
    expect(error.message).toBe(ERROR_MESSAGES[code]);
  });

  it("is case-insensitive", () => expect(classifyError("NETWORK ERROR").code).toBe("network"));
  it("undefined message → unknown, retryable", () => {
    const error = classifyError(undefined);
    expect(error.code).toBe("unknown");
    expect(error.retryable).toBe(true);
    expect(error.cause).toBeUndefined();
  });
  it("unsupported is not retryable; others are", () => {
    expect(classifyError("unsupported").retryable).toBe(false);
    expect(classifyError("403").retryable).toBe(true);
  });
  it("first matching code in order wins (403 before network)", () => {
    expect(classifyError("network 403").code).toBe("expired");
  });
  it("strips query strings from the cause", () => {
    expect(classifyError("Failed https://cdn.test/v.mp4?token=abc now").cause).toBe("Failed https://cdn.test/v.mp4 now");
  });
});

describe("stripQuery", () => {
  it("removes ?… up to whitespace or end", () => {
    expect(stripQuery("a?b=1")).toBe("a");
    expect(stripQuery("x https://h/p?q=1&r=2 y")).toBe("x https://h/p y");
    expect(stripQuery("no query")).toBe("no query");
  });
});
