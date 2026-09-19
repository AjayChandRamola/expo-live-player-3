// __tests__/Logger.test.ts
// Regression tests for utils/Logger.
// Logger's real API: default export object { debug, info, warn, error,
// installGlobalErrorHandlers } and the same five as named exports.
// The first argument of each level function is a SCOPE, not the message.
//
// utils/Logger.ts binds console.debug/info/warn/error to local references at
// MODULE LOAD time (see safeConsole()). Because of that, the module must be
// (re)required *after* the console spies are installed in each test, or the
// spies never intercept the calls Logger makes through its already-bound
// references. jest.resetModules() + a fresh require() per test achieves that.
import type * as LoggerModule from "../utils/Logger";

describe("Logger", () => {
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let Logger: typeof LoggerModule.default;
  let debug: typeof LoggerModule.debug;
  let info: typeof LoggerModule.info;
  let warn: typeof LoggerModule.warn;
  let error: typeof LoggerModule.error;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});

    // Logger binds console methods at module-load time, so it must be
    // re-required after the spies above are installed for this test.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../utils/Logger");
    Logger = mod.default;
    debug = mod.debug;
    info = mod.info;
    warn = mod.warn;
    error = mod.error;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("is silent for debug and info when __DEV__ is false, and still emits warn and error", () => {
    const g = globalThis as { __DEV__?: boolean };
    const previous = g.__DEV__;
    g.__DEV__ = false;
    try {
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const prod = require("../utils/Logger").default as typeof Logger;
      prod.debug("Scope", "d");
      prod.info("Scope", "i");
      prod.warn("Scope", "w");
      prod.error("Scope", "e");
      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      g.__DEV__ = previous;
    }
  });

  it("exposes the documented API on the default export", () => {
    expect(typeof Logger.debug).toBe("function");
    expect(typeof Logger.info).toBe("function");
    expect(typeof Logger.warn).toBe("function");
    expect(typeof Logger.error).toBe("function");
    expect(typeof Logger.installGlobalErrorHandlers).toBe("function");
  });

  it("exposes the same functions as named exports", () => {
    expect(typeof debug).toBe("function");
    expect(typeof info).toBe("function");
    expect(typeof warn).toBe("function");
    expect(typeof error).toBe("function");
  });

  it("writes an INFO line carrying the scope and message", () => {
    Logger.info("Player", "started");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const line = String(infoSpy.mock.calls[0][0]);
    expect(line).toContain("[INFO]");
    expect(line).toContain("[Player]");
    expect(line).toContain("started");
  });

  it("routes each level to its own console method", () => {
    Logger.debug("Scope", "d");
    Logger.warn("Scope", "w");
    Logger.error("Scope", "e");
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("serializes object arguments instead of printing [object Object]", () => {
    Logger.info("Scope", { videoId: "abc" });
    const line = String(infoSpy.mock.calls[0][0]);
    expect(line).toContain('"videoId":"abc"');
    expect(line).not.toContain("[object Object]");
  });

  it("accepts a null scope without throwing", () => {
    expect(() => Logger.info(null, "no scope")).not.toThrow();
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("does not throw on a circular object", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    expect(() => Logger.info("Scope", circular)).not.toThrow();
  });

  it("installGlobalErrorHandlers is idempotent and does not throw", () => {
    expect(() => Logger.installGlobalErrorHandlers()).not.toThrow();
    expect(() => Logger.installGlobalErrorHandlers()).not.toThrow();
  });
});
